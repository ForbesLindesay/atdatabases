import Queue, {AsyncQueue} from '..';

test('Queue', () => {
  const queue = new Queue<number>();
  queue.push(1);
  queue.push(2);
  queue.push(3);
  expect(queue.shift()).toBe(1);
  queue.push(4);
  expect(queue.shift()).toBe(2);
  expect(queue.shift()).toBe(3);
  expect(queue.shift()).toBe(4);
  queue.push(5);
  queue.push(6);
  queue.push(7);
  expect(queue.shift()).toBe(5);
  queue.push(8);
  queue.push(9);
  queue.push(10);
  expect(queue.getLength()).toBe(5);
  expect(queue.clear()).toEqual([6, 7, 8, 9, 10]);
  expect(queue.getLength()).toBe(0);
  expect(queue.shift()).toBe(undefined);
});

test('AsyncQueue', async () => {
  var q = new AsyncQueue<number>();
  var results = new Queue<Promise<number>>();
  expect(q.getLength()).toBe(0);
  q.push(1);
  expect(q.getLength()).toBe(1);
  q.push(2);
  expect(q.getLength()).toBe(2);
  q.push(3);
  expect(q.getLength()).toBe(3);

  expect(await q.shift()).toBe(1);
  expect(q.getLength()).toBe(2);
  expect(await q.shift()).toBe(2);
  expect(q.getLength()).toBe(1);
  expect(await q.shift()).toBe(3);
  expect(q.getLength()).toBe(0);

  results.push(q.shift());
  expect(q.getLength()).toBe(-1);
  results.push(q.shift());
  expect(q.getLength()).toBe(-2);
  results.push(q.shift());
  expect(q.getLength()).toBe(-3);

  q.push(1);
  expect(q.getLength()).toBe(-2);
  expect(await results.shift()).toBe(1);

  q.push(2);
  expect(q.getLength()).toBe(-1);
  expect(await results.shift()).toBe(2);

  q.push(3);
  expect(q.getLength()).toBe(0);
  expect(await results.shift()).toBe(3);
});
