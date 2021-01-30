export default class Queue<T> {
  private _head: T[] = [];
  private _tail: T[] = [];
  push(value: T) {
    this._tail.push(value);
  }
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
  getLength() {
    return this._head.length + this._tail.length;
  }
  clear() {
    const removed = this._head.concat(this._tail);
    this._head = [];
    this._tail = [];
    return removed;
  }
}
