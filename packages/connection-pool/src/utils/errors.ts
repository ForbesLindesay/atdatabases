export function openTimeout() {
  return Object.assign(new Error(`Timed out waiting for open connection.`), {
    code: `CONNECTION_POOL:OPEN_TIMEOUT`,
  });
}
export function queueTimeoutError() {
  return Object.assign(
    new Error('Timed out waiting for connection from pool.'),
    {
      code: 'CONNECTION_POOL:QUEUE_TIMEOUT',
    },
  );
}

export function doubleReleaseError() {
  return Object.assign(
    new Error(
      'Release called on client which has already been released to the pool.',
    ),
    {code: 'CONNECTION_POOL:DOUBLE_RELEASE'},
  );
}

export function globalError(err: Error) {
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
    return ex;
  }
}
