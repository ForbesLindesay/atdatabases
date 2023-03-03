import dedupeAsync, {
  DedupeAsyncOptions,
  DedupeAsyncOptionsWithCache,
  DedupeAsyncOptionsWithMapKey,
  DedupedAsyncFunction,
} from './dedupeAsync';
import dedupeSync from './dedupeSync';
import enqueuePostPromiseJob from './enqueuePostPromiseJob';
import {AsyncCacheMap, CacheMapInput} from './types';

export type BatchResponse<TKey, TResult> =
  | ((key: TKey) => Promise<TResult> | TResult)
  | {get(key: TKey): Promise<TResult> | TResult};

export interface BatchOptions<TKey> {
  maxBatchSize?: number;
  batchScheduleFn?: () => Promise<void>;
  mapKey?: (key: TKey) => unknown;
}

export interface BatchedFunction<TKey, TResult> {
  (key: TKey): Promise<TResult>;
  dedupe<TMappedKey = TKey>(
    options?: DedupeAsyncOptions<TKey, TResult, TMappedKey>,
  ): DedupedAsyncFunction<TKey, TResult>;
}

function getResultFromBatchResponse<TKey, TResult>(
  response: BatchResponse<TKey, TResult>,
  source: TKey,
): Promise<TResult> | TResult {
  if (typeof response === 'function') {
    return response(source);
  }
  return response.get(source);
}

class Batch<TKey, TResult> {
  private _started = false;
  private readonly _requests = new Map<
    unknown,
    {
      key: TKey;
      resolve: (result: TResult | PromiseLike<TResult>) => void;
      reject: (error: Error) => void;
    }
  >();
  private readonly _loadBatch: (
    requests: TKey[],
  ) => Promise<BatchResponse<TKey, TResult>>;
  private readonly _mapKey: (key: TKey) => unknown;
  public readonly loadOne: (key: TKey) => Promise<TResult>;
  constructor(
    loadBatch: (requests: TKey[]) => Promise<BatchResponse<TKey, TResult>>,
    mapKey: (key: TKey) => unknown,
  ) {
    this._loadBatch = loadBatch;
    this._mapKey = mapKey;
    this.loadOne = dedupeSync((key: TKey): Promise<TResult> => {
      return new Promise<TResult>((resolve, reject) => {
        if (this._started) {
          reject(
            new Error(`You cannot load using a batch that has already started`),
          );
          return;
        }
        this._requests.set(this._mapKey(key), {key, resolve, reject});
      });
    });
  }
  getSize() {
    return this._requests.size;
  }

  processBatch() {
    if (this._started) {
      throw new Error('You cannot process the same batch multiple times');
    }
    this._started = true;
    this._loadBatch([...this._requests.values()].map((v) => v.key)).then(
      (results) => {
        for (const {key, resolve} of this._requests.values()) {
          resolve(getResultFromBatchResponse(results, key));
        }
      },
      (err) => {
        for (const {reject} of this._requests.values()) {
          reject(err);
        }
      },
    );
  }
}

/**
 * The batch function is used to batch requests to a load function. The load
 * function is called with an array of keys and must return a promise that
 * resolves to a "BatchResponse".
 *
 * Unlike the batch function, batchGroups takes a "Group Key" as well as the key.
 * Only calls that share the same group key will be ba
 *
 * The BatchResponse can be either a function that takes a key and returns a
 *
 * Unlike the batch function, batchGroups takes a "Group Key" as well as the key.
 * Only calls that share the same group key will be ba
 * result, or an object with a `get` method that takes a key and returns a
 * result (such as a Map).
 */
export default function batch<TKey, TResult>(
  load: (requests: TKey[]) => Promise<BatchResponse<TKey, TResult>>,
  {
    maxBatchSize = Infinity,
    batchScheduleFn = enqueuePostPromiseJob,
    mapKey = (key: TKey) => key,
  }: BatchOptions<TKey> = {},
): BatchedFunction<TKey, TResult> {
  let batch: Batch<TKey, TResult> | null = null;
  const batchedFunction = (source: TKey): Promise<TResult> => {
    if (batch === null) {
      const newBatch = new Batch<TKey, TResult>(load, mapKey);
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
  options: BatchGroupsOptions<TGroupKey, TKey, TMappedGroupKey> = {},
): BatchedGroupFunction<TGroupKey, TKey, TResult> {
  const {
    maxBatchSize = Infinity,
    batchScheduleFn = enqueuePostPromiseJob,
    mapKey = (key: TKey) => key,
  } = options;

  // @ts-expect-error If not using mapGroupKey, then TMappedGroupKey is TGroupKey
  const mapGroupKey: (key: TGroupKey) => TMappedGroupKey =
    options.mapGroupKey ?? ((group: TGroupKey) => group);
  // @ts-expect-error If not using mapGroupKey, then TMappedGroupKey is TGroupKey. We also don't export the Batch<TKey, TResult> type
  const groupMap: Map<
    TMappedGroupKey,
    Batch<TKey, TResult>
  > = options.groupMap ?? new Map<TMappedGroupKey, unknown>();

  const batchedFunction = (group: TGroupKey, key: TKey): Promise<TResult> => {
    const groupKey = mapGroupKey(group);
    let batch = groupMap.get(groupKey);
    if (batch === undefined) {
      const newBatch = new Batch<TKey, TResult>(async (requests) => {
        return await load(group, requests);
      }, mapKey);
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
