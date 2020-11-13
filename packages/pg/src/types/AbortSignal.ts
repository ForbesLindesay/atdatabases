/**
 * This a subset of the AbortSignal API that's built into modern JS environments
 */
export default interface AbortSignal {
  readonly aborted: boolean;
  addEventListener(type: 'abort', listener: () => void): void;
  removeEventListener(type: 'abort', listener: () => void): void;
}
