import createLeveledCache from '../createLeveledCache';

test('oneLevel', () => {
  const cache = createLeveledCache<number>().build<string>();
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
  const cache = createLeveledCache<number>().addLevel<number>().build<string>();

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
  const cache = createLeveledCache<number>()
    .addLevel<number>()
    .addLevel<number>()
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
