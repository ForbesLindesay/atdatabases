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

  expect(load.cache.get('hello')).resolves.toEqual({source: 'hello'});
  expect(load.cache.get('world')).resolves.toEqual({source: 'world'});

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

  expect(load.cache.get({id: 'hello'})).resolves.toEqual({source: 'hello'});
  expect(load.cache.get({id: 'world'})).resolves.toEqual({source: 'world'});

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

  expect(load.cache.get(HELLO_REQUEST)).resolves.toEqual({source: 'hello'});
  expect(load.cache.get(WORLD_REQUEST)).resolves.toEqual({source: 'world'});

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
