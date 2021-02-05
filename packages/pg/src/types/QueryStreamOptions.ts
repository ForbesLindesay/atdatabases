import AbortSignal from './AbortSignal';

export default interface QueryStreamOptions {
  batchSize?: number;
  signal?: AbortSignal;
}
