export function openTimeout(): Error {
  return Object.assign(new Error(`Timed out waiting for open connection.`), {
    code: `CONNECTION_POOL:OPEN_TIMEOUT`,
  });
}
export function queueTimeoutError(): Error {
  return Object.assign(
    new Error('Timed out waiting for connection from pool.'),
    {
      code: 'CONNECTION_POOL:QUEUE_TIMEOUT',
    },
  );
}

export function doubleReleaseError(): Error {
  return Object.assign(
    new Error(
      'Release called on client which has already been released to the pool.',
    ),
    {code: 'CONNECTION_POOL:DOUBLE_RELEASE'},
  );
}

export function globalError(err: Error): void {
  setTimeout(() => {
    throw err;
  }, 0);
}

export function attemptHook<TArgs extends any[]>(
  fn: undefined | ((...args: TArgs) => void),
  ...args: TArgs
): Error | undefined {
  try {
    if (fn) {
      fn(...args);
    }
    return undefined;
  } catch (ex) {
    return ex as Error;
  }
}

export const connectionLimitExceeded: unique symbol = Symbol(
  'CONNECTION_LIMIT_EXCEEDED',
);
export type ConnectionLimitExceeded = typeof connectionLimitExceeded;

export function isConnectionLimitExceeded<T>(
  value: T | ConnectionLimitExceeded,
): value is ConnectionLimitExceeded {
  return value === connectionLimitExceeded;
}
