export type {
  BatchGroupsOptions,
  BatchGroupsOptionsWithMapGroupKey,
  BatchGroupsOptionsWithoutMapGroupKey,
  BatchOptions,
  BatchResponse,
  BatchResponseArray,
  BatchResponseFunction,
  BatchResponseMap,
} from './batch';
export type {
  MultiKeyMap,
  MultiKeyMapOption,
  MultiKeyMapOptions,
  MultiKeyMapOptionWithMapKey,
  MultiKeyMapOptionWithoutMapKey,
} from './MultiKeyMap';
export type {
  DedupeAsyncOptions,
  DedupeAsyncOptionsWithMapKey,
  DedupeAsyncOptionsWithoutMapKey,
  DedupedAsyncFunction,
} from './dedupeAsync';
export type {
  DedupedSyncFunction,
  DedupeSyncOptions,
  DedupeSyncOptionsWithMapKey,
  DedupeSyncOptionsWithoutMapKey,
} from './dedupeSync';
export type {
  AsyncCacheMap,
  CacheMap,
  CacheMapInput,
  KeyPrefix,
  Path,
  SubPath,
} from './types';

export {default as batch, batchGroups} from './batch';
export {default as createMultiKeyMap} from './MultiKeyMap';
export {default as dedupeAsync} from './dedupeAsync';
export {default as dedupeSync} from './dedupeSync';

export {
  groupBy,
  parametersSpreadToArray,
  parametersArrayToSpread,
} from './utils';
