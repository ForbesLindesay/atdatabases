import createNamespacedCache from '../createNamespacedCache';

test('oneLevel', () => {
  const cache = createNamespacedCache<number>().build<string>();
  cache.set([1], 'one');
  expect(cache.get([1])).toBe('one');
  expect(cache.get([2])).toBe(undefined);

  cache.delete([1]);
  expect(cache.get([1])).toBe(undefined);

  cache.set([1], 'one');
  cache.set([2], 'two');
  cache.clear();
  expect(cache.get([1])).toBe(undefined);
  expect(cache.get([2])).toBe(undefined);
});

test('twoLevels', () => {
  const cache = createNamespacedCache<number>()
    .addNamespace<number>()
    .build<string>();

  cache.set([1, 1], 'one-one');
  cache.set([1, 2], 'one-two');
  cache.set([2, 1], 'two-one');
  cache.set([2, 2], 'two-two');

  expect(cache.get([1, 1])).toBe('one-one');
  expect(cache.get([1, 2])).toBe('one-two');
  expect(cache.get([2, 1])).toBe('two-one');
  expect(cache.get([2, 2])).toBe('two-two');
  expect(cache.get([1, 3])).toBe(undefined);
  expect(cache.get([3, 1])).toBe(undefined);

  cache.delete([1, 1]);
  expect(cache.get([1, 1])).toBe(undefined);
  expect(cache.get([1, 2])).toBe('one-two');

  cache.delete([2]);
  expect(cache.get([2, 1])).toBe(undefined);
  expect(cache.get([2, 2])).toBe(undefined);

  cache.set([1, 1], 'one-one');
  cache.set([1, 2], 'one-two');
  cache.set([2, 1], 'two-one');
  cache.set([2, 2], 'two-two');
  cache.clear();
  expect(cache.get([1, 1])).toBe(undefined);
  expect(cache.get([1, 2])).toBe(undefined);
  expect(cache.get([2, 1])).toBe(undefined);
  expect(cache.get([2, 2])).toBe(undefined);
});

test('threeLevels', () => {
  const cache = createNamespacedCache<number>()
    .addNamespace<number>()
    .addNamespace<number>()
    .build<string>();

  cache.set([1, 1, 1], 'one-one-one');
  cache.set([1, 2, 1], 'one-two-one');
  cache.set([2, 1, 1], 'two-one-one');
  cache.set([2, 2, 1], 'two-two-one');

  expect(cache.get([1, 1, 1])).toBe('one-one-one');
  expect(cache.get([1, 2, 1])).toBe('one-two-one');
  expect(cache.get([2, 1, 1])).toBe('two-one-one');
  expect(cache.get([2, 2, 1])).toBe('two-two-one');
  expect(cache.get([1, 3, 1])).toBe(undefined);
  expect(cache.get([3, 1, 1])).toBe(undefined);

  cache.delete([1, 1, 1]);
  expect(cache.get([1, 1, 1])).toBe(undefined);
  expect(cache.get([1, 2, 1])).toBe('one-two-one');

  cache.delete([2, 1]);
  expect(cache.get([2, 1, 1])).toBe(undefined);
  expect(cache.get([2, 2, 1])).toBe('two-two-one');
  cache.delete([2]);
  expect(cache.get([2, 2, 1])).toBe(undefined);

  cache.set([1, 1, 1], 'one-one-one');
  cache.set([1, 2, 1], 'one-two-one');
  cache.set([2, 1, 1], 'two-one-one');
  cache.set([2, 2, 1], 'two-two-one');
  cache.clear();
  expect(cache.get([1, 1, 1])).toBe(undefined);
  expect(cache.get([1, 2, 1])).toBe(undefined);
  expect(cache.get([2, 1, 1])).toBe(undefined);
  expect(cache.get([2, 2, 1])).toBe(undefined);
});

test('twoLevels - custom cache and mapKey', () => {
  const cache = createNamespacedCache<{}>({
    getCache: <T>() => new WeakMap<{}, T>(),
  })
    .addNamespace<{id: number}, number>({mapKey: (k) => k.id})
    .build<string>();

  const A = {};
  const B = {};
  const C = {};

  cache.set([A, {id: 1}], 'one-one');
  cache.set([A, {id: 2}], 'one-two');
  cache.set([B, {id: 1}], 'two-one');
  cache.set([B, {id: 2}], 'two-two');

  expect(cache.get([A, {id: 1}])).toBe('one-one');
  expect(cache.get([A, {id: 2}])).toBe('one-two');
  expect(cache.get([B, {id: 1}])).toBe('two-one');
  expect(cache.get([B, {id: 2}])).toBe('two-two');
  expect(cache.get([A, {id: 3}])).toBe(undefined);
  expect(cache.get([C, {id: 1}])).toBe(undefined);

  cache.delete([A, {id: 1}]);
  expect(cache.get([A, {id: 1}])).toBe(undefined);
  expect(cache.get([A, {id: 2}])).toBe('one-two');

  cache.delete([B]);
  expect(cache.get([B, {id: 1}])).toBe(undefined);
  expect(cache.get([B, {id: 2}])).toBe(undefined);

  cache.set([A, {id: 1}], 'one-one');
  cache.set([A, {id: 2}], 'one-two');
  cache.set([B, {id: 1}], 'two-one');
  cache.set([B, {id: 2}], 'two-two');
  cache.clear();
  expect(cache.get([A, {id: 1}])).toBe(undefined);
  expect(cache.get([A, {id: 2}])).toBe(undefined);
  expect(cache.get([B, {id: 1}])).toBe(undefined);
  expect(cache.get([B, {id: 2}])).toBe(undefined);
});
