const Queue = require('then-queue');
interface Queue<T> {
  push(item: T): void;
  pop(): Promise<T>;
  /**
   * Amount of items in the queue
   * This can be negative if pop has been called more times than push.
   */
  length: number;
}
interface PushStream<T> {
  onData(fn: (value: T) => void): void;
  onError(fn: (err: any) => void): void;
  onEnd(fn: () => void): void;
  pause(): void;
  resume(): void;
  highWaterMark: number;
}
export default function pushToAsyncIterable<T>(stream: PushStream<T>) {
  const queue: Queue<
    {done: false; value: T} | {done: true; err: any}
  > = new Queue();
  let paused = false;
  let ended = false;
  stream.onData((value) => {
    if (!ended) {
      queue.push({done: false, value});
      if (!paused && queue.length >= stream.highWaterMark) {
        paused = true;
        stream.pause();
      }
    }
  });
  stream.onError((err) => {
    if (!ended) {
      ended = true;
      queue.push({done: true, err});
      if (paused) {
        paused = false;
        stream.resume();
      }
    }
  });
  stream.onEnd(() => {
    if (!ended) {
      ended = true;
      queue.push({done: true, err: undefined});
      if (paused) {
        paused = false;
        stream.resume();
      }
    }
  });
  return queueConsumer(queue, () => {
    if (paused && queue.length < stream.highWaterMark) {
      paused = false;
      stream.resume();
    }
  });
}
async function* queueConsumer<T>(
  queue: Queue<{done: false; value: T} | {done: true; err: any}>,
  onPop: () => void,
) {
  let value = await queue.pop();
  while (!value.done) {
    yield value.value;
    const next = queue.pop();
    onPop();
    value = await next;
  }
  if (value.err) {
    throw value.err;
  }
}
