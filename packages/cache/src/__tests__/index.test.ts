import createCacheRealm from '../';

test(`Can create multiple separate caches`, () => {
  const {createCache} = createCacheRealm({maximumSize: 1_000});

  const cacheA = createCache<string, string>({
    name: `a`,
  });
  const cacheB = createCache<string, string>({
    name: `b`,
  });

  cacheA.set(`x`, `cache_a_value`);
  cacheB.set(`x`, `cache_b_value`);

  expect(cacheA.get(`x`)).toBe(`cache_a_value`);
  expect(cacheB.get(`x`)).toBe(`cache_b_value`);

  // can delete a cached value
  cacheA.delete(`x`);
  expect(cacheA.get(`x`)).toBe(undefined);

  // can clear a cache
  cacheB.clear();
  expect(cacheB.get(`x`)).toBe(undefined);
});

test(`Can expire caches after a timeout`, () => {
  let mockTime = 0;
  const {createCache} = createCacheRealm({
    maximumSize: 1_000,
    getTime: () => mockTime,
  });

  const cache = createCache<string, string>({
    name: `t`,
    expireAfterMilliseconds: 10,
  });

  cache.set(`x`, `value_to_expire`);
  expect(cache.get(`x`)).toBe(`value_to_expire`);

  mockTime += 50;
  expect(cache.get(`x`)).toBe(undefined);
});

test(`Can use object keys directly (but probably you shouldn't)`, () => {
  const {createCache} = createCacheRealm({maximumSize: 1_000});

  const cache = createCache<any, string>({
    name: `o`,
  });

  const keyA = {};
  const keyB = {};
  cache.set(keyA, `value_with_object_key`);
  expect(cache.get(keyA)).toBe(`value_with_object_key`);
  expect(cache.get(keyB)).toBe(undefined);
});

test(`Can use object keys via transform function`, () => {
  const {createCache} = createCacheRealm({maximumSize: 1_000});

  const cache = createCache<{x: number; y: number}, string>({
    name: `o`,
    mapKey: ({x, y}) => `${x}:${y}`,
  });

  cache.set({x: 0, y: 0}, `value_with_object_key`);
  expect(cache.get({x: 0, y: 0})).toBe(`value_with_object_key`);
  expect(cache.get({x: 1, y: 1})).toBe(undefined);
});

test(`Limits total shared cache capacity`, () => {
  const maximumSize = 100;
  const {createCache} = createCacheRealm({maximumSize});

  const cacheEven = createCache<number, string>({
    name: `even`,
  });
  const cacheOdd = createCache<number, string>({
    name: `odd`,
  });
  const cacheOther = createCache<number, string>({
    name: `other`,
  });

  const cacheToClear = createCache<number, string>({
    name: `clear`,
  });
  const cacheToDelete = createCache<number, string>({
    name: `del`,
  });
  for (let i = 0; i < maximumSize; i++) {
    if (i % 2 === 0) {
      // if we clear the value it won't count towards cache size
      cacheToClear.set(i, `value_to_clear`);
      cacheToClear.clear();

      cacheEven.set(i, `v${i}`);
    } else {
      // if we delete the value it won't count towards cache size
      cacheToDelete.set(i, `value_to_delete`);
      cacheToDelete.delete(i);

      cacheOdd.set(i, `v${i}`);
    }
  }
  for (let i = 0; i < maximumSize; i++) {
    if (i % 2 === 0) {
      expect(cacheEven.get(i)).toBe(`v${i}`);
    } else {
      expect(cacheOdd.get(i)).toBe(`v${i}`);
    }
  }

  cacheOther.set(1, `v`);
  expect(cacheEven.get(0)).toBe(undefined);

  cacheOther.set(2, `v`);
  expect(cacheOdd.get(1)).toBe(undefined);

  for (let i = 3; i < maximumSize; i++) {
    if (i % 2 === 0) {
      expect(cacheEven.get(i)).toBe(`v${i}`);
    } else {
      expect(cacheOdd.get(i)).toBe(`v${i}`);
    }
  }
});

test(`Can replicate deletes`, () => {
  const realmA = createCacheRealm({
    maximumSize: 1_000,
    onReplicationEvent(e) {
      realmB.writeReplicationEvent(e);
    },
  });
  const realmB = createCacheRealm({
    maximumSize: 1_000,
    onReplicationEvent(e) {
      realmA.writeReplicationEvent(e);
    },
  });

  const cacheA = realmA.createCache<number, string>({
    name: `MyCache`,
  });
  const cacheB = realmB.createCache<number, string>({
    name: `MyCache`,
  });

  // We do not replicate writes
  cacheA.set(1, `value`);
  expect(cacheB.get(1)).toBe(undefined);

  cacheB.set(1, `valueB`);
  expect(cacheA.get(1)).toBe(`value`);

  // We do replicate delete
  cacheB.delete(1);
  expect(cacheA.get(1)).toBe(undefined);
  expect(cacheB.get(1)).toBe(undefined);

  // We do replicate clear
  cacheA.set(1, `value`);
  cacheB.set(1, `valueB`);
  cacheB.clear();
  expect(cacheA.get(1)).toBe(undefined);
  expect(cacheB.get(1)).toBe(undefined);

  // We can replicate multiple deletes in one message
  cacheA.set(1, `value`);
  cacheB.set(1, `valueB`);
  cacheA.set(2, `value2`);
  cacheB.set(2, `value2B`);
  cacheA.set(3, `value3`);
  cacheB.set(3, `value3B`);
  cacheB.delete(1, 2);
  expect(cacheA.get(1)).toBe(undefined);
  expect(cacheB.get(1)).toBe(undefined);
  expect(cacheA.get(2)).toBe(undefined);
  expect(cacheB.get(2)).toBe(undefined);
  expect(cacheA.get(3)).toBe(`value3`);
  expect(cacheB.get(3)).toBe(`value3B`);
});

test(`Can replicate prefix deletes`, () => {
  const realmA = createCacheRealm({
    maximumSize: 1_000,
    onReplicationEvent(e) {
      realmB.writeReplicationEvent(e);
    },
  });
  const realmB = createCacheRealm({
    maximumSize: 1_000,
    onReplicationEvent(e) {
      realmA.writeReplicationEvent(e);
    },
  });

  const cacheA = realmA.createCache<string[], string>({
    name: `MyCache`,
    mapKey: (key) => key.join(`:`),
  });
  const cacheB = realmB.createCache<string[], string>({
    name: `MyCache`,
    mapKey: (key) => key.join(`:`),
  });

  // We can replicate multiple deletes in one message
  cacheA.set([`a`, `1`], `value`);
  cacheB.set([`a`, `1`], `valueB`);
  cacheA.set([`a`, `2`], `value2`);
  cacheB.set([`a`, `2`], `value2B`);
  cacheA.set([`b`, `3`], `value3`);
  cacheB.set([`b`, `3`], `value3B`);

  expect(cacheA.get([`a`, `1`])).toBe(`value`);
  expect(cacheB.get([`a`, `1`])).toBe(`valueB`);
  expect(cacheA.get([`a`, `2`])).toBe(`value2`);
  expect(cacheB.get([`a`, `2`])).toBe(`value2B`);
  expect(cacheA.get([`b`, `3`])).toBe(`value3`);
  expect(cacheB.get([`b`, `3`])).toBe(`value3B`);

  cacheB.deletePrefix(`a:`);
  expect(cacheA.get([`a`, `1`])).toBe(undefined);
  expect(cacheB.get([`a`, `1`])).toBe(undefined);
  expect(cacheA.get([`a`, `2`])).toBe(undefined);
  expect(cacheB.get([`a`, `2`])).toBe(undefined);
  expect(cacheA.get([`b`, `3`])).toBe(`value3`);
  expect(cacheB.get([`b`, `3`])).toBe(`value3B`);
});
