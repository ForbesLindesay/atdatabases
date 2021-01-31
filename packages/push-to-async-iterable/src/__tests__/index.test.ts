import pushToAsyncIterable from '../';

test('pushToAsyncIterable', async () => {
  const pause = jest.fn();
  const resume = jest.fn();
  const dispose = jest.fn();
  let onData!: (data: number) => void;
  let onError!: (err: any) => void;
  let onEnd!: () => void;
  const result = pushToAsyncIterable<number>((handlers) => {
    onData = handlers.onData;
    onError = handlers.onError;
    onEnd = handlers.onEnd;
    return {
      pause,
      resume,
      dispose,
      highWaterMark: 2,
    };
  });
  onData(1);
  expect(pause).not.toBeCalled();
  expect(resume).not.toBeCalled();

  expect(await result.next()).toEqual({done: false, value: 1});
  expect(pause).not.toBeCalled();
  expect(resume).not.toBeCalled();

  onData(2);
  expect(pause).not.toBeCalled();
  expect(resume).not.toBeCalled();

  onData(3);
  expect(pause).toBeCalledTimes(1);
  expect(resume).not.toBeCalled();

  onData(4);
  expect(pause).toBeCalledTimes(1);
  expect(resume).not.toBeCalled();

  expect(await result.next()).toEqual({done: false, value: 2});
  expect(pause).toBeCalledTimes(1);
  expect(resume).not.toBeCalled();

  expect(await result.next()).toEqual({done: false, value: 3});
  expect(pause).toBeCalledTimes(1);
  expect(resume).toBeCalledTimes(1);

  expect(await result.next()).toEqual({done: false, value: 4});
  expect(pause).toBeCalledTimes(1);
  expect(resume).toBeCalledTimes(1);

  onEnd();
  expect(pause).toBeCalledTimes(1);
  expect(resume).toBeCalledTimes(1);

  expect(await result.next()).toEqual({done: true});
  expect(pause).toBeCalledTimes(1);
  expect(resume).toBeCalledTimes(1);

  expect(typeof onError).toBe('function');
});

test('pushToAsyncIterable Error', async () => {
  const pause = jest.fn();
  const resume = jest.fn();
  const dispose = jest.fn();
  let onData!: (data: number) => void;
  let onError!: (err: any) => void;
  let onEnd!: () => void;
  const result = pushToAsyncIterable<number>((handlers) => {
    onData = handlers.onData;
    onError = handlers.onError;
    onEnd = handlers.onEnd;
    return {
      pause,
      resume,
      dispose,
      highWaterMark: 2,
    };
  });
  onData(1);
  expect(pause).not.toBeCalled();
  expect(resume).not.toBeCalled();

  expect(await result.next()).toEqual({done: false, value: 1});
  expect(pause).not.toBeCalled();
  expect(resume).not.toBeCalled();

  const TEST_ERROR = {};
  onError(TEST_ERROR);
  await expect(result.next()).rejects.toBe(TEST_ERROR);
  expect(pause).not.toBeCalled();
  expect(resume).not.toBeCalled();

  expect(typeof onEnd).toBe('function');
});
