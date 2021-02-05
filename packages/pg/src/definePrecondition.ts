export default function definePrecondition<TArgs extends any[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
) {
  let done = false;
  let doing = false;
  let queue: {
    resolve: (value: undefined) => void;
    reject: (err: Error) => void;
  }[] = [];
  const consumeQueue = () => {
    const q = queue;
    queue = [];
    return q;
  };
  const emptyPromise = Promise.resolve(undefined);
  const callPrecondition = async (
    ...args: TArgs
  ): Promise<TResult | undefined> => {
    if (!done) {
      if (doing) {
        return new Promise<undefined>((resolve, reject) =>
          queue.push({resolve, reject}),
        );
      } else {
        doing = true;
        return fn(...args).then(
          (value) => {
            done = true;
            doing = false;
            for (const {resolve} of consumeQueue()) {
              resolve(undefined);
            }
            return value;
          },
          (err) => {
            doing = false;
            for (const {reject} of consumeQueue()) {
              reject(err);
            }
            throw err;
          },
        );
      }
    } else {
      return emptyPromise;
    }
  };
  return {
    hasDonePrecondition: () => {
      return done;
    },
    callPrecondition,
    resetPrecondition: () => {
      done = false;
    },
  };
}
