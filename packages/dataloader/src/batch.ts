import enqueuePostPromiseJob from './enqueuePostPromiseJob';
import {CacheMapInput} from './types';

export type BatchResponseFunction<TKey, TResult> = (
  key: TKey,
  index: number,
  keys: TKey[],
) => Promise<TResult> | TResult;
export type BatchResponseMap<TKey, TResult> = {
  get: (key: TKey) => Promise<TResult> | TResult;
};
export type BatchResponseArray<TResult> = readonly (
  | Promise<TResult>
  | TResult
)[];

export type BatchResponse<TKey, TResult> =
  | BatchResponseFunction<TKey, TResult>
  | BatchResponseMap<TKey, TResult>
  | BatchResponseArray<TResult>;

export interface BatchOptions {
  readonly maxBatchSize?: number;
  readonly batchScheduleFn?: () => Promise<void>;
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

  async loadOne(key: TKey): Promise<TResult> {
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
        const responseFn = normalizeBatchResponse(response);
        this._requests.forEach(({key, resolve}, index) => {
          resolve(responseFn(key, index, keys));
        });
      })
      .catch((err) => {
        for (const {reject} of this._requests) {
          reject(err);
        }
      });
  }
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
  options?: BatchOptions,
): (key: TKey) => Promise<TResult> {
  const {maxBatchSize, batchScheduleFn} = normalizeBatchOptions(options);
  let batch: Batch<TKey, TResult> | null = null;
  return async (key: TKey): Promise<TResult> => {
    if (batch === null) {
      const newBatch = new Batch<TKey, TResult>(load);
      batch = newBatch;
      /* tslint:disable:no-floating-promises */
      batchScheduleFn().then(() => {
        if (batch === newBatch) {
          newBatch.processBatch();
          batch = null;
        }
      });
    }
    const result = batch.loadOne(key);
    if (batch.getSize() >= maxBatchSize) {
      batch.processBatch();
      batch = null;
    }
    return result;
  };
}

function normalizeBatchResponse<TKey, TResult>(
  response: BatchResponse<TKey, TResult>,
): BatchResponseFunction<TKey, TResult> {
  if (typeof response === 'function') return response;
  if (isReadonlyArray(response)) return fromArrayResponse(response);
  return fromMapResponse(response);
}

function fromArrayResponse<TKey, TResult>(
  response: BatchResponseArray<TResult>,
): BatchResponseFunction<TKey, TResult> {
  return (_key, index) => response[index];
}

function fromMapResponse<TKey, TResult>(
  response: BatchResponseMap<TKey, TResult>,
): BatchResponseFunction<TKey, TResult> {
  return (key) => response.get(key);
}

interface NormalizedBatchOptions {
  maxBatchSize: number;
  batchScheduleFn: () => Promise<void>;
}
function normalizeBatchOptions(options?: BatchOptions): NormalizedBatchOptions {
  return {
    maxBatchSize: options?.maxBatchSize ?? Infinity,
    batchScheduleFn: options?.batchScheduleFn ?? enqueuePostPromiseJob,
  };
}

export interface BatchGroupsOptionsWithMapGroupKey<TGroupKey, TMappedGroupKey>
  extends BatchOptions {
  readonly groupMap?: CacheMapInput<TMappedGroupKey, unknown>;
  readonly mapGroupKey: (key: TGroupKey) => TMappedGroupKey;
}

export interface BatchGroupsOptionsWithoutMapGroupKey<TGroupKey>
  extends BatchOptions {
  readonly groupMap?: CacheMapInput<TGroupKey, unknown>;
  readonly mapGroupKey?: undefined;
}

export type BatchGroupsOptions<TGroupKey, TMappedGroupKey = TGroupKey> =
  | BatchGroupsOptionsWithMapGroupKey<TGroupKey, TMappedGroupKey>
  | BatchGroupsOptionsWithoutMapGroupKey<TGroupKey>;

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
  options?: BatchGroupsOptions<TGroupKey, TMappedGroupKey>,
): (group: TGroupKey, key: TKey) => Promise<TResult> {
  const {maxBatchSize, batchScheduleFn, mapGroupKey, groupMap} =
    normalizeBatchGroupOptions<TGroupKey, TKey, TResult, TMappedGroupKey>(
      options,
    );

  const batchedFunction = async (
    group: TGroupKey,
    key: TKey,
  ): Promise<TResult> => {
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
  return batchedFunction;
}

interface NormalizedBatchGroupOptions<TGroupKey, TKey, TResult, TMappedGroupKey>
  extends NormalizedBatchOptions {
  mapGroupKey: (key: TGroupKey) => TMappedGroupKey;
  groupMap: Map<TMappedGroupKey, Batch<TKey, TResult>>;
}
function normalizeBatchGroupOptions<TGroupKey, TKey, TResult, TMappedGroupKey>(
  options?: BatchGroupsOptions<TGroupKey, TMappedGroupKey>,
): NormalizedBatchGroupOptions<TGroupKey, TKey, TResult, TMappedGroupKey> {
  return {
    ...normalizeBatchOptions(options),
    // @ts-expect-error If not using mapGroupKey, then TMappedGroupKey is TGroupKey
    mapGroupKey: options?.mapGroupKey ?? ((group: TGroupKey) => group),
    // @ts-expect-error If not using mapGroupKey, then TMappedGroupKey is TGroupKey. We also don't export the Batch<TKey, TResult> type
    groupMap: options?.groupMap ?? new Map<TMappedGroupKey, unknown>(),
  };
}

function isReadonlyArray<TValues, TOther>(
  value: TOther | readonly TValues[],
): value is readonly TValues[] {
  return Array.isArray(value);
}
