export interface RequestsTester<T> {
  add(request: T): void;
  expect(requests: T[], fn: () => Promise<void>): Promise<void>;
  expect(requests: T[], fn: () => void): void;
}
export default function requestsTester<T>(): RequestsTester<T> {
  let requests: T[] | null = null;
  return {
    add(request: T) {
      if (requests === null)
        throw new Error(`Unexpected request: ${JSON.stringify(request)}`);
      requests.push(request);
    },
    // @ts-expect-error overloaded function
    expect(
      expectedRequests: T[],
      fn: () => void | Promise<void>,
    ): Promise<void> | void {
      if (requests !== null) {
        throw new Error(
          `Cannot call expect() twice multiple times in parallel.`,
        );
      }
      requests = [];

      const fnResult = fn();
      const afterFn = () => {
        expect(
          requests!.sort((a, b) =>
            JSON.stringify(a) < JSON.stringify(b) ? -1 : 1,
          ),
        ).toEqual(
          expectedRequests.sort((a, b) =>
            JSON.stringify(a) < JSON.stringify(b) ? -1 : 1,
          ),
        );

        requests = null;
      };
      if (fnResult && typeof fnResult.then === 'function') {
        return fnResult.then(afterFn);
      } else {
        afterFn();
      }
    },
  };
}
