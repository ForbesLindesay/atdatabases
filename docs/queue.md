---
id: queue
title: '@databases/queue'
sidebar_label: queue
---

The `@databases/queue` package provides a high speed queue, and a special "async" queue. Using a JavaScript Array as a Queue is very inefficient because each time you remove an item from the start of an Array, JavaScript must re-index every item in the array.

Fortunately, JavaScript Array's are very efficient when used as stacks (i.e. you only use `push` and `pop`) because these operations do not require re-indexing. You can build an array out of two stacks, which is exaclty what `@databases/queue` does.

## Usage

```typescript
import Queue, {AsyncQueue} from '@databases/queue';

const q = new Queue<number>();

q.push(1);
q.push(2);
q.push(3);
console.log(q.shift()); // => 1
console.log(q.shift()); // => 2
console.log(q.shift()); // => 3
console.log(q.shift()); // => undefined

const aq = new AsyncQueue<number>();
aq.push(1);
aq.shift().then((v) => console.log(v)); // => 1
aq.shift().then((v) => console.log(v)); // => 2
aq.shift().then((v) => console.log(v)); // => 3
aq.push(2);
aq.push(3);
```

```javascript
const Queue = require('@databases/queue');
const {AsyncQueue} = require('@databases/queue');

const q = new Queue();

q.push(1);
q.push(2);
q.push(3);
console.log(q.shift()); // => 1
console.log(q.shift()); // => 2
console.log(q.shift()); // => 3
console.log(q.shift()); // => undefined

const aq = new AsyncQueue();
aq.push(1);
aq.shift().then((v) => console.log(v)); // => 1
aq.shift().then((v) => console.log(v)); // => 2
aq.shift().then((v) => console.log(v)); // => 3
aq.push(2);
aq.push(3);
```

## API

```typescript
export default class Queue<T> {
  /**
   * Push an item onto the end of the queue
   */
  push(value: T): void;
  /**
   * Take an item off the start of the queue
   */
  shift(): T | undefined;
  /**
   * Get the total number of items in the queue
   */
  getLength(): number;
  /**
   * Remove (and return) all items from the queue
   */
  clear(): T[];
}

export class AsyncQueue<T> {
  /**
   * Push an item onto the end of the queue
   */
  push(value: T): void;
  /**
   * Get the next item from the start queue, waiting until one
   * is added if the queue is currently empty
   */
  shift(): Promise<T>;
  /**
   * Get the number of items currently in the queue
   *
   * N.B. this can be negative if `.shift()` has been called more times than `.push()`
   */
  getLength(): number;
}
```
