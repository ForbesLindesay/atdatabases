import {AsyncQueue} from '@databases/queue';

export interface PushStreamInput<T> {
  onData(value: T): void;
  onError(err: any): void;
  onEnd(): void;
}
export interface PushStream {
  dispose(): void;
  pause(): void;
  resume(): void;
  highWaterMark: number;
}

export default function pushToAsyncIterable<T>(
  getStream: (input: PushStreamInput<T>) => PushStream,
): AsyncGenerator<T, void, unknown> {
  const queue = new AsyncQueue<
    {done: false; value: T} | {done: true; err: any}
  >();
  let bufferSize = 0;
  let paused = false;
  let ended = false;
  const stream = getStream({
    onData(value) {
      if (!ended) {
        queue.push({done: false, value});
        bufferSize++;
        if (!paused && bufferSize >= stream.highWaterMark) {
          paused = true;
          stream.pause();
        }
      }
    },
    onError(err) {
      if (!ended) {
        ended = true;
        queue.push({done: true, err});
      }
    },
    onEnd() {
      if (!ended) {
        ended = true;
        queue.push({done: true, err: undefined});
      }
    },
  });
  return {
    async next(): Promise<IteratorResult<T, void>> {
      bufferSize--;
      if (paused && bufferSize < stream.highWaterMark) {
        paused = false;
        stream.resume();
      }
      const next = await queue.shift();
      if (next.done && next.err) {
        throw next.err;
      } else if (next.done) {
        return {done: true, value: undefined};
      } else {
        return next;
      }
    },
    async return(): Promise<IteratorResult<T, void>> {
      stream.dispose();
      return {done: true, value: undefined};
    },
    async throw(e): Promise<IteratorResult<T, void>> {
      stream.dispose();
      throw e;
    },
    [Symbol.asyncIterator](): AsyncGenerator<T, void, unknown> {
      return this;
    },
  };
}
