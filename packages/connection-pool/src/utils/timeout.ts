import isPromise from 'is-promise';

export const timeout = Symbol('TIMEOUT');
export type Timeout = typeof timeout;

export function isTimeout<T>(value: T | Timeout): value is Timeout {
  return value === timeout;
}
export function isNotTimeout<T>(value: T | Timeout): value is T {
  return value !== timeout;
}
export async function withTimeout<TArgs extends any[], TResult>(
  fn: (...args: TArgs) => Promise<TResult> | TResult,
  {
    timeoutMilliseconds,
    onResultAfterTimeout,
  }: {
    timeoutMilliseconds: number;
    onResultAfterTimeout?: (result: TResult) => void;
  },
  ...args: TArgs
): Promise<TResult | Timeout> {
  if (timeoutMilliseconds === Infinity) {
    return await fn(...args);
  }
  return await new Promise<TResult | Timeout>((resolve, reject) => {
    const promise = fn(...args);
    if (isPromise(promise)) {
      let timedOut = false;
      const t = setTimeout(() => {
        timedOut = true;
        resolve(timeout);
      }, timeoutMilliseconds);
      promise.then(
        (v) => {
          if (timedOut) {
            if (onResultAfterTimeout) onResultAfterTimeout(v);
          } else {
            clearTimeout(t);
            resolve(v);
          }
        },
        (err) => {
          clearTimeout(t);
          reject(err);
        },
      );
    } else {
      resolve(promise);
    }
  });
}
