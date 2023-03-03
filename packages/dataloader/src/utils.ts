export function parametersSpreadToArray<TParameters extends unknown[], TResult>(
  fn: (args: TParameters) => TResult,
): (...args: TParameters) => TResult {
  return (...args) => fn(args);
}

export function parametersArrayToSpread<TParameters extends unknown[], TResult>(
  fn: (...args: TParameters) => TResult,
): (args: TParameters) => TResult {
  return (args) => fn(...args);
}

export function addFallbackForUndefined<TParameters extends unknown[], TResult>(
  fn: (...args: TParameters) => TResult | undefined,
  fallback: (...args: TParameters) => TResult,
): (...args: TParameters) => TResult {
  return (...args: TParameters) => {
    const result = fn(...args);
    return result === undefined ? fallback(...args) : result;
  };
}

export function addFallbackForUndefinedAsync<
  TParameters extends unknown[],
  TResult,
>(
  fn: (
    ...args: TParameters
  ) => Promise<TResult | undefined> | TResult | undefined,
  fallback: (...args: TParameters) => Promise<TResult> | TResult,
): (...args: TParameters) => Promise<TResult> {
  return async (...args: TParameters) => {
    const result = await fn(...args);
    return result === undefined ? await fallback(...args) : result;
  };
}
