import {Timeout, timeout} from './timeout';

/**
 * A task in the queue that is waiting for a connection
 * to become available.
 */
export default class Waiter<T> {
  static waiterTimeout<T>(waiter: Waiter<T>) {
    if (waiter._resolve) {
      waiter._resolve(timeout);
      waiter._resolve = null;
    }
  }
  private _resolve: null | ((result: Promise<T> | T | Timeout) => unknown);
  private readonly _timeout: number | undefined;
  constructor(
    resolve: (result: Promise<T> | T | Timeout) => unknown,
    timeoutMilliseconds: number,
  ) {
    this._resolve = resolve;
    if (timeoutMilliseconds !== Infinity) {
      this._timeout = setTimeout(
        // tslint:disable-next-line: no-unbound-method
        Waiter.waiterTimeout,
        timeoutMilliseconds,
        this,
      );
    }
  }
  public isTimedOut() {
    return this._resolve === null;
  }
  public resolve(connection: T | Promise<T>) {
    clearTimeout(this._timeout);
    this._resolve!(connection);
  }
}
