import dedupeAsync, {
  DedupeAsyncOptions,
  DedupeAsyncOptionsWithCache,
  DedupeAsyncOptionsWithMapKey,
  DedupedAsyncFunction,
} from './dedupeAsync';
import enqueuePostPromiseJob from './enqueuePostPromiseJob';
import {AsyncCacheMap, CacheMapInput} from './types';

export type BatchResponse<TKey, TResult> =
  | ((key: TKey, index: number, keys: TKey[]) => Promise<TResult> | TResult)
  | {get(key: TKey): Promise<TResult> | TResult}
  | readonly TResult[];

export interface BatchOptions<TKey> {
  maxBatchSize?: number;
  batchScheduleFn?: () => Promise<void>;
}

export interface BatchedFunction<TKey, TResult> {
  (key: TKey): Promise<TResult>;
  dedupe<TMappedKey = TKey>(
    options?: DedupeAsyncOptions<TKey, TResult, TMappedKey>,
  ): DedupedAsyncFunction<TKey, TResult>;
}

class Batch<TKey, TResult> {
  private _started = false;
  private readonly _requests: {
    key: TKey;
    resolve: (result: TResult | PromiseLike<TResult>) => void;
    reject: (error: Error) => void;
  }[] = [];
  private readonly _loadBatch: (
    requests: TKey[],
  ) => Promise<BatchResponse<TKey, TResult>>;
  constructor(
    loadBatch: (requests: TKey[]) => Promise<BatchResponse<TKey, TResult>>,
  ) {
    this._loadBatch = loadBatch;
  }

  getSize() {
    return this._requests.length;
  }

  loadOne(key: TKey): Promise<TResult> {
    return new Promise<TResult>((resolve, reject) => {
      if (this._started) {
        reject(
          new Error(`You cannot load using a batch that has already started`),
        );
        return;
      }
      this._requests.push({key, resolve, reject});
    });
  }

  processBatch() {
    if (this._started) {
      throw new Error('You cannot process the same batch multiple times');
    }
    this._started = true;
    const keys = this._requests.map((v) => v.key);
    this._loadBatch(keys)
      .then((response) => {
        if (typeof response === 'function') {
          this._requests.forEach(({key, resolve}, index) => {
            resolve(response(key, index, keys));
          });
        } else if (isReadonlyArray(response)) {
          if (response.length !== this._requests.length) {
            throw new Error(
              `Batch response length does not match request length. Expected ${this._requests.length} but got ${response.length}`,
            );
          }
          this._requests.forEach(({resolve}, index) => {
            resolve(response[index]);
          });
        } else {
          for (const {key, resolve} of this._requests) {
            resolve(response.get(key));
          }
        }
      })
      .catch((err) => {
        for (const {reject} of this._requests) {
          reject(err);
        }
      });
  }
}

function isReadonlyArray<TValues, TOther>(
  value: TOther | readonly TValues[],
): value is readonly TValues[] {
  return Array.isArray(value);
}

/**
 * The batch function is used to batch requests to a load function. The load
 * function is called with an array of keys and must return a promise that
 * resolves to a "BatchResponse".
 *
 * The BatchResponse can be one of:
 * - a function that takes a "key" and "index" and returns a result
 * - an array of results in the same order as the keys and of the same length
 * - an object with a "get" method that takes a key and returns a result
 */
export default function batch<TKey, TResult>(
  load: (requests: TKey[]) => Promise<BatchResponse<TKey, TResult>>,
  options?: BatchOptions<TKey>,
): BatchedFunction<TKey, TResult> {
  const {maxBatchSize, batchScheduleFn} = normalizeBatchOptions(options);
  let batch: Batch<TKey, TResult> | null = null;
  const batchedFunction = (source: TKey): Promise<TResult> => {
    if (batch === null) {
      const newBatch = new Batch<TKey, TResult>(load);
      batch = newBatch;
      batchScheduleFn().then(() => {
        if (batch === newBatch) {
          newBatch.processBatch();
          batch = null;
        }
      });
    }
    const result = batch.loadOne(source);
    if (batch.getSize() >= maxBatchSize) {
      batch.processBatch();
      batch = null;
    }
    return result;
  };
  return Object.assign(batchedFunction, {
    dedupe<TMappedKey = TKey>(
      options?: DedupeAsyncOptions<TKey, TResult, TMappedKey>,
    ) {
      return dedupeAsync(batchedFunction, options);
    },
  });
}

interface NormalizedBatchOptions<TKey, TResult> {
  maxBatchSize: number;
  batchScheduleFn: () => Promise<void>;
}
function normalizeBatchOptions<TKey, TResult>(
  options?: BatchOptions<TKey>,
): NormalizedBatchOptions<TKey, TResult> {
  return {
    maxBatchSize: options?.maxBatchSize ?? Infinity,
    batchScheduleFn: options?.batchScheduleFn ?? enqueuePostPromiseJob,
  };
}

export interface BatchGroupsOptionsWithMapGroupKey<
  TGroupKey,
  TKey,
  TMappedGroupKey,
> extends BatchOptions<TKey> {
  groupMap?: CacheMapInput<TMappedGroupKey, unknown>;
  mapGroupKey: (key: TGroupKey) => TMappedGroupKey;
}

export interface BatchGroupsOptionsWithoutMapGroupKey<TGroupKey, TKey>
  extends BatchOptions<TKey> {
  groupMap?: CacheMapInput<TGroupKey, unknown>;
  mapGroupKey?: undefined;
}

export type BatchGroupsOptions<TGroupKey, TKey, TMappedGroupKey = TGroupKey> =
  | BatchGroupsOptionsWithMapGroupKey<TGroupKey, TKey, TMappedGroupKey>
  | BatchGroupsOptionsWithoutMapGroupKey<TGroupKey, TKey>;

export interface BatchedGroupFunction<TGroupKey, TKey, TResult> {
  (group: TGroupKey, key: TKey): Promise<TResult>;
  dedupe<TMappedKey = TKey>(
    options:
      | DedupeAsyncOptionsWithCache<[TGroupKey, TKey], TResult>
      | DedupeAsyncOptionsWithMapKey<[TGroupKey, TKey], TResult, TMappedKey>,
  ): DedupedBatchedGroupFunction<TGroupKey, TKey, TResult>;
}
export interface DedupedBatchedGroupFunction<TGroupKey, TKey, TResult> {
  (group: TGroupKey, key: TKey): Promise<TResult>;
  cache: AsyncCacheMap<[TGroupKey, TKey], TResult>;
}

/**
 * The batchGroups function is used to batch requests to a load function. The
 * load function is called with an array of keys and must return a promise that
 * resolves to a "BatchResponse".
 *
 * Unlike the batch function, batchGroups takes a "Group Key" as well as the key.
 * Only calls that share the same group key will be batched together.
 */
export function batchGroups<
  TGroupKey,
  TKey,
  TResult,
  TMappedGroupKey = TGroupKey,
>(
  load: (
    group: TGroupKey,
    requests: TKey[],
  ) => Promise<BatchResponse<TKey, TResult>>,
  options?: BatchGroupsOptions<TGroupKey, TKey, TMappedGroupKey>,
): BatchedGroupFunction<TGroupKey, TKey, TResult> {
  const {maxBatchSize, batchScheduleFn, mapGroupKey, groupMap} =
    normalizeBatchGroupOptions<TGroupKey, TKey, TResult, TMappedGroupKey>(
      options,
    );

  const batchedFunction = (group: TGroupKey, key: TKey): Promise<TResult> => {
    const groupKey = mapGroupKey(group);
    let batch = groupMap.get(groupKey);
    if (batch === undefined) {
      const newBatch = new Batch<TKey, TResult>(async (requests) => {
        return await load(group, requests);
      });
      groupMap.set(groupKey, newBatch);
      batchScheduleFn().then(() => {
        if (groupMap.get(groupKey) === newBatch) {
          newBatch.processBatch();
          groupMap.delete(groupKey);
        }
      });
      batch = newBatch;
    }
    const result = batch.loadOne(key);
    if (batch.getSize() >= maxBatchSize) {
      batch.processBatch();
      groupMap.delete(groupKey);
    }
    return result;
  };
  return Object.assign(batchedFunction, {
    dedupe<TMappedKey>(
      options:
        | DedupeAsyncOptionsWithCache<[TGroupKey, TKey], TResult>
        | DedupeAsyncOptionsWithMapKey<[TGroupKey, TKey], TResult, TMappedKey>,
    ) {
      const fn = dedupeAsync<[TGroupKey, TKey], TResult, TMappedKey>(
        ([groupKey, key]) => batchedFunction(groupKey, key),
        options,
      );
      return Object.assign(
        (groupKey: TGroupKey, key: TKey) => fn([groupKey, key]),
        {
          cache: fn.cache,
        },
      );
    },
  });
}

interface NormalizedBatchGroupOptions<TGroupKey, TKey, TResult, TMappedGroupKey>
  extends NormalizedBatchOptions<TKey, TResult> {
  mapGroupKey: (key: TGroupKey) => TMappedGroupKey;
  groupMap: Map<TMappedGroupKey, Batch<TKey, TResult>>;
}
function normalizeBatchGroupOptions<TGroupKey, TKey, TResult, TMappedGroupKey>(
  options?: BatchGroupsOptions<TGroupKey, TKey, TMappedGroupKey>,
): NormalizedBatchGroupOptions<TGroupKey, TKey, TResult, TMappedGroupKey> {
  return {
    ...normalizeBatchOptions(options),
    // @ts-expect-error If not using mapGroupKey, then TMappedGroupKey is TGroupKey
    mapGroupKey: options?.mapGroupKey ?? ((group: TGroupKey) => group),
    // @ts-expect-error If not using mapGroupKey, then TMappedGroupKey is TGroupKey. We also don't export the Batch<TKey, TResult> type
    groupMap: options?.groupMap ?? new Map<TMappedGroupKey, unknown>(),
  };
}
