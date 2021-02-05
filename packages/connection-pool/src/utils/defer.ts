export default function defer<T>(): readonly [
  Promise<T>,
  void extends T
    ? (value?: T | PromiseLike<T>) => void
    : (value: T | PromiseLike<T>) => void,
  (err: Error) => void,
] {
  let resolve: void extends T
    ? (value?: T | PromiseLike<T>) => void
    : (value: T | PromiseLike<T>) => void;
  let reject: (err: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res as any;
    reject = rej;
  });
  return [promise, resolve!, reject!] as const;
}
