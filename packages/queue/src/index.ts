// See https://gist.github.com/ForbesLindesay/cb5d6ea7720ee8912109dd2cca787590 for justification of design

export default class Queue<T> {
  private _head: T[] = [];
  private _tail: T[] = [];
  /**
   * Push an item onto the end of the queue
   */
  push(value: T) {
    this._tail.push(value);
  }
  /**
   * Take an item off the start of the queue
   */
  shift(): T | undefined {
    if (this._head.length !== 0) {
      return this._head.pop();
    }
    if (this._tail.length === 1) {
      return this._tail.pop();
    }
    if (this._tail.length > 1) {
      [this._head, this._tail] = [this._tail.reverse(), this._head];
      return this._head.pop();
    }
    return undefined;
  }
  /**
   * Look at an item off the start of the queue without removing it
   */
  peek(): T | undefined {
    if (this._head.length !== 0) {
      return this._head[this._head.length - 1];
    }
    if (this._tail.length !== 0) {
      return this._tail[0];
    }
    return undefined;
  }
  /**
   * Get the total number of items in the queue
   */
  getLength() {
    return this._head.length + this._tail.length;
  }
  /**
   * Remove (and return) all items from the queue
   */
  clear() {
    const removed = this._head.reverse().concat(this._tail);
    this._head = [];
    this._tail = [];
    return removed;
  }
}

export class AsyncQueue<T> {
  private readonly _items = new Queue<T>();
  private readonly _waiting = new Queue<(value: T) => void>();
  /**
   * Push an item onto the end of the queue
   */
  push(value: T) {
    const waiting = this._waiting.shift();
    if (waiting) {
      waiting(value);
    } else {
      this._items.push(value);
    }
  }
  /**
   * Get the next item from the start queue, waiting until one
   * is added if the queue is currently empty
   */
  async shift(): Promise<T> {
    const item = this._items.shift();
    if (item) {
      return item;
    } else {
      return new Promise((resolve) => {
        this._waiting.push(resolve);
      });
    }
  }
  /**
   * Get the number of items currently in the queue
   *
   * N.B. this can be negative if `.shift()` has been called more times than `.push()`
   */
  getLength() {
    return this._items.getLength() - this._waiting.getLength();
  }
}

module.exports = Object.assign(Queue, {
  default: Queue,
  AsyncQueue: AsyncQueue,
});
