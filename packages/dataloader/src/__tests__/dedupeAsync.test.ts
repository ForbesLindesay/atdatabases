import createMultiKeyMap from '../MultiKeyMap';
import dedupeAsync from '../dedupeAsync';
import requestsTester from './requestsTester';

test('dedupeAsync', async () => {
  const requests = requestsTester<string>();
  const load = dedupeAsync(async (source: string) => {
    requests.add(source);
    if (source === 'ERROR_THIS') {
      throw new Error('Errored');
    }
    if (source === 'NOT_FOUND') {
      return undefined;
    }
    return {source};
  });

  await requests.expect(['hello', 'world'], async () => {
    expect(
      await Promise.all([load('hello'), load('hello'), load('world')]),
    ).toEqual([{source: 'hello'}, {source: 'hello'}, {source: 'world'}]);
  });

  await requests.expect(['ERROR_THIS', 'NOT_FOUND'], async () => {
    expect(
      await Promise.all([
        load('hello'),
        load('world'),
        load('ERROR_THIS').catch((ex) => ex.message),
        load('NOT_FOUND'),
      ]),
    ).toEqual([{source: 'hello'}, {source: 'world'}, 'Errored', undefined]);
  });

  await requests.expect(['ERROR_THIS'], async () => {
    expect(
      await Promise.all([
        load('hello'),
        load('world'),
        load('ERROR_THIS').catch((ex) => ex.message),
        load('NOT_FOUND'),
      ]),
    ).toEqual([{source: 'hello'}, {source: 'world'}, 'Errored', undefined]);
  });

  await expect(load.cache.get('hello')).resolves.toEqual({source: 'hello'});
  await expect(load.cache.get('world')).resolves.toEqual({source: 'world'});

  load.cache.delete('hello');
  load.cache.set('world', {source: 'from set'});

  await requests.expect(['hello'], async () => {
    expect(await Promise.all([load('hello'), load('world')])).toEqual([
      {source: 'hello'},
      {source: 'from set'},
    ]);
  });

  load.cache.clear();
  await requests.expect(['hello', 'world'], async () => {
    expect(await Promise.all([load('hello'), load('world')])).toEqual([
      {source: 'hello'},
      {source: 'world'},
    ]);
  });
});

test('dedupeAsync - mapKey', async () => {
  const requests = requestsTester<string>();
  const load = dedupeAsync(
    async ({id}: {id: string}) => {
      requests.add(id);
      if (id === 'ERROR_THIS') {
        throw new Error('Errored');
      }
      return {source: id};
    },
    {mapKey: (source) => source.id},
  );

  await requests.expect([`hello`, `world`], async () => {
    expect(
      await Promise.all([
        load({id: 'hello'}),
        load({id: 'hello'}),
        load({id: 'world'}),
      ]),
    ).toEqual([{source: 'hello'}, {source: 'hello'}, {source: 'world'}]);
  });

  await requests.expect([`ERROR_THIS`], async () => {
    expect(
      await Promise.all([
        load({id: 'hello'}),
        load({id: 'world'}),
        load({id: 'ERROR_THIS'}).catch((ex) => ex.message),
      ]),
    ).toEqual([{source: 'hello'}, {source: 'world'}, 'Errored']);
  });

  await requests.expect([`ERROR_THIS`], async () => {
    expect(
      await Promise.all([
        load({id: 'hello'}),
        load({id: 'world'}),
        load({id: 'ERROR_THIS'}).catch((ex) => ex.message),
      ]),
    ).toEqual([{source: 'hello'}, {source: 'world'}, 'Errored']);
  });

  await expect(load.cache.get({id: 'hello'})).resolves.toEqual({
    source: 'hello',
  });
  await expect(load.cache.get({id: 'world'})).resolves.toEqual({
    source: 'world',
  });

  load.cache.delete({id: 'hello'});
  load.cache.set({id: 'world'}, {source: 'from set'});

  await requests.expect(['hello'], async () => {
    expect(
      await Promise.all([load({id: 'hello'}), load({id: 'world'})]),
    ).toEqual([{source: 'hello'}, {source: 'from set'}]);
  });

  load.cache.clear();
  await requests.expect(['hello', 'world'], async () => {
    expect(
      await Promise.all([load({id: 'hello'}), load({id: 'world'})]),
    ).toEqual([{source: 'hello'}, {source: 'world'}]);
  });
});

test('dedupeAsync - shouldCache', async () => {
  const requests = requestsTester<string>();
  const load = dedupeAsync(
    async (source: string) => {
      requests.add(source);
      if (source === 'ERROR_THIS') {
        throw new Error('Errored');
      }
      if (source === 'NOT_FOUND') {
        return undefined;
      }
      return {source};
    },
    {shouldCache: (v) => v !== undefined},
  );

  await requests.expect(['hello', 'world'], async () => {
    expect(
      await Promise.all([load('hello'), load('hello'), load('world')]),
    ).toEqual([{source: 'hello'}, {source: 'hello'}, {source: 'world'}]);
  });

  await requests.expect(['ERROR_THIS', 'NOT_FOUND'], async () => {
    expect(
      await Promise.all([
        load('hello'),
        load('world'),
        load('ERROR_THIS').catch((ex) => ex.message),
        load('NOT_FOUND'),
      ]),
    ).toEqual([{source: 'hello'}, {source: 'world'}, 'Errored', undefined]);
  });

  await requests.expect(['ERROR_THIS', 'NOT_FOUND'], async () => {
    expect(
      await Promise.all([
        load('hello'),
        load('world'),
        load('ERROR_THIS').catch((ex) => ex.message),
        load('NOT_FOUND'),
      ]),
    ).toEqual([{source: 'hello'}, {source: 'world'}, 'Errored', undefined]);
  });
});

test('dedupeAsync - WeakMap', async () => {
  const requests = requestsTester<string>();
  const load = dedupeAsync(
    async ({id}: {id: string}) => {
      requests.add(id);
      if (id === 'ERROR_THIS') {
        throw new Error('Errored');
      }
      return {source: id};
    },
    {cache: new WeakMap()},
  );

  const HELLO_REQUEST = {id: 'hello'};
  const WORLD_REQUEST = {id: 'world'};
  const ERROR_REQUEST = {id: 'ERROR_THIS'};

  await requests.expect([`hello`, `world`], async () => {
    expect(
      await Promise.all([
        load(HELLO_REQUEST),
        load(HELLO_REQUEST),
        load(WORLD_REQUEST),
      ]),
    ).toEqual([{source: 'hello'}, {source: 'hello'}, {source: 'world'}]);
  });

  await requests.expect([`ERROR_THIS`], async () => {
    expect(
      await Promise.all([
        load(HELLO_REQUEST),
        load(WORLD_REQUEST),
        load(ERROR_REQUEST).catch((ex) => ex.message),
      ]),
    ).toEqual([{source: 'hello'}, {source: 'world'}, 'Errored']);
  });

  await requests.expect([`ERROR_THIS`], async () => {
    expect(
      await Promise.all([
        load(HELLO_REQUEST),
        load(WORLD_REQUEST),
        load(ERROR_REQUEST).catch((ex) => ex.message),
      ]),
    ).toEqual([{source: 'hello'}, {source: 'world'}, 'Errored']);
  });

  await expect(load.cache.get(HELLO_REQUEST)).resolves.toEqual({
    source: 'hello',
  });
  await expect(load.cache.get(WORLD_REQUEST)).resolves.toEqual({
    source: 'world',
  });

  load.cache.delete(HELLO_REQUEST);
  load.cache.set(WORLD_REQUEST, {source: 'from set'});

  await requests.expect(['hello'], async () => {
    expect(
      await Promise.all([load(HELLO_REQUEST), load(WORLD_REQUEST)]),
    ).toEqual([{source: 'hello'}, {source: 'from set'}]);
  });

  expect(() => load.cache.clear()).toThrow(
    `This cache does not support clearing`,
  );
  await requests.expect([], async () => {
    expect(
      await Promise.all([load(HELLO_REQUEST), load(WORLD_REQUEST)]),
    ).toEqual([{source: 'hello'}, {source: 'from set'}]);
  });
});

test('dedupeAsync - MultiKeyMap', async () => {
  const requests = requestsTester<`${string}:${number}`>();
  const load = dedupeAsync(
    async ([{id}, value]: [{id: string}, number]) => {
      requests.add(`${id}:${value}`);
      if (id === 'ERROR_THIS') {
        throw new Error('Errored');
      }
      return {source: id, value};
    },
    {
      cache: createMultiKeyMap<
        [{id: string}, number],
        Promise<{source: string; value: number}>
      >([{getCache: () => new WeakMap()}, {}]),
    },
  );

  const HELLO_REQUEST = {id: 'hello'};
  const WORLD_REQUEST = {id: 'world'};

  await requests.expect([`hello:1`, `hello:2`, `world:3`], async () => {
    expect(
      await Promise.all([
        load([HELLO_REQUEST, 1]),
        load([HELLO_REQUEST, 2]),
        load([WORLD_REQUEST, 3]),
      ]),
    ).toEqual([
      {source: 'hello', value: 1},
      {source: 'hello', value: 2},
      {source: 'world', value: 3},
    ]);
  });

  await expect(load.cache.get([HELLO_REQUEST, 1])).resolves.toEqual({
    source: 'hello',
    value: 1,
  });
  await expect(load.cache.get([HELLO_REQUEST, 2])).resolves.toEqual({
    source: 'hello',
    value: 2,
  });
  await expect(load.cache.get([WORLD_REQUEST, 3])).resolves.toEqual({
    source: 'world',
    value: 3,
  });

  load.cache.deletePrefix([HELLO_REQUEST]);
  load.cache.set([WORLD_REQUEST, 3], {source: 'from set', value: 3});

  await requests.expect([`hello:1`, `hello:2`], async () => {
    expect(
      await Promise.all([
        load([HELLO_REQUEST, 1]),
        load([HELLO_REQUEST, 2]),
        load([WORLD_REQUEST, 3]),
      ]),
    ).toEqual([
      {source: 'hello', value: 1},
      {source: 'hello', value: 2},
      {source: 'from set', value: 3},
    ]);
  });

  await requests.expect([], async () => {
    expect(
      await Promise.all([
        load([HELLO_REQUEST, 1]),
        load([HELLO_REQUEST, 2]),
        load([WORLD_REQUEST, 3]),
      ]),
    ).toEqual([
      {source: 'hello', value: 1},
      {source: 'hello', value: 2},
      {source: 'from set', value: 3},
    ]);
  });
});

test('dedupeAsync - delete spread', async () => {
  let deleteCalls = 0;
  class MapWithDeleteSpread<TKey, TValue> extends Map<TKey, TValue> {
    delete(...keys: TKey[]) {
      deleteCalls++;
      for (const key of keys) {
        super.delete(key);
      }
      return true;
    }
  }
  class MapWithoutDeleteSpread<TKey, TValue> extends Map<TKey, TValue> {
    delete(key: TKey) {
      deleteCalls++;
      return super.delete(key);
    }
  }
  const requests = requestsTester<string>();
  const load = dedupeAsync(
    async (source: string) => {
      requests.add(source);
      return {source};
    },
    {cache: new MapWithDeleteSpread()},
  );

  await requests.expect(['hello', 'world', 'other'], async () => {
    expect(
      await Promise.all([
        load('hello'),
        load('hello'),
        load('world'),
        load('other'),
      ]),
    ).toEqual([
      {source: 'hello'},
      {source: 'hello'},
      {source: 'world'},
      {source: 'other'},
    ]);
  });
  load.cache.delete('hello', 'world');
  expect(deleteCalls).toBe(1);
  await requests.expect(['hello', 'world'], async () => {
    expect(
      await Promise.all([
        load('hello'),
        load('hello'),
        load('world'),
        load('other'),
      ]),
    ).toEqual([
      {source: 'hello'},
      {source: 'hello'},
      {source: 'world'},
      {source: 'other'},
    ]);
  });

  deleteCalls = 0;
  const load2 = dedupeAsync(
    async (source: string) => {
      requests.add(source);
      return {source};
    },
    {cache: new MapWithoutDeleteSpread()},
  );

  await requests.expect(['hello', 'world', 'other'], async () => {
    expect(
      await Promise.all([
        load2('hello'),
        load2('hello'),
        load2('world'),
        load2('other'),
      ]),
    ).toEqual([
      {source: 'hello'},
      {source: 'hello'},
      {source: 'world'},
      {source: 'other'},
    ]);
  });
  load2.cache.delete('hello', 'world');
  expect(deleteCalls).toBe(2);
  await requests.expect(['hello', 'world'], async () => {
    expect(
      await Promise.all([
        load2('hello'),
        load2('hello'),
        load2('world'),
        load2('other'),
      ]),
    ).toEqual([
      {source: 'hello'},
      {source: 'hello'},
      {source: 'world'},
      {source: 'other'},
    ]);
  });
});

test('dedupeAsync - delete prefix', async () => {
  const requests = requestsTester<string>();
  const load = dedupeAsync(async (source: string) => {
    requests.add(source);
    return {source};
  });

  await requests.expect(['hello:1', 'hello:2', 'world:3'], async () => {
    expect(
      await Promise.all([
        load('hello:1'),
        load('hello:2'),
        load('world:3'),
        load('hello:1'),
      ]),
    ).toEqual([
      {source: 'hello:1'},
      {source: 'hello:2'},
      {source: 'world:3'},
      {source: 'hello:1'},
    ]);
  });
  load.cache.deletePrefix('hello:');
  await requests.expect(['hello:1', 'hello:2'], async () => {
    expect(
      await Promise.all([
        load('hello:1'),
        load('hello:2'),
        load('world:3'),
        load('hello:1'),
      ]),
    ).toEqual([
      {source: 'hello:1'},
      {source: 'hello:2'},
      {source: 'world:3'},
      {source: 'hello:1'},
    ]);
  });
});
