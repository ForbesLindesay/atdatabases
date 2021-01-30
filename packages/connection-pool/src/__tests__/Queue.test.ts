import Queue from '../Queue';

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
  expect(queue.getLength()).toBe(3);
  expect(queue.clear()).toEqual([5, 6, 7]);
  expect(queue.getLength()).toBe(0);
  expect(queue.shift()).toBe(undefined);
});
