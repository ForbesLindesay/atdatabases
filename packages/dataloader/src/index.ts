export type {
  BatchResponse,
  BatchOptions,
  BatchedFunction,
  BatchGroupsOptions,
  BatchedGroupFunction,
  DedupedBatchedGroupFunction,
} from './batch';
export type {
  NamespacedCache,
  NamespaceOptions,
  NamespaceOptionsWithMapKey,
  NamespaceOptionsWithoutMapKey,
  NamespacedCacheBuilder,
} from './createNamespacedCache';
export type {
  DedupedAsyncFunction,
  DedupeAsyncOptions,
  DedupeAsyncOptionsWithMapKey,
  DedupeAsyncOptionsWithoutMapKey,
} from './dedupeAsync';
export type {
  DedupedSyncFunction,
  DedupeSyncOptions,
  DedupeSyncOptionsWithMapKey,
  DedupeSyncOptionsWithoutMapKey,
} from './dedupeSync';
export type {CacheMapInput, CacheMap} from './types';

export {default as batch, batchGroups} from './batch';
export {default as createNamespacedCache} from './createNamespacedCache';
export {default as dedupeAsync} from './dedupeAsync';
export {default as dedupeSync} from './dedupeSync';
export {default as groupToMap} from './groupToMap';

export {
  parametersSpreadToArray,
  parametersArrayToSpread,
  addFallbackForUndefinedSync,
  addFallbackForUndefinedAsync,
} from './utils';
