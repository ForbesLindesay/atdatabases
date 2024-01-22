import dedupeSync from '../dedupeSync';
import requestsTester from './requestsTester';

test('dedupeSync', () => {
  const requests = requestsTester<string>();
  const load = dedupeSync((source: string) => {
    requests.add(source);
    if (source === 'ERROR_THIS') {
      throw new Error('Errored');
    }
    if (source === 'NOT_FOUND') {
      return null;
    }
    if (source === 'NOT_DEFINED') {
      return undefined;
    }
    return {source};
  });

  requests.expect(['hello', 'world'], () => {
    expect(load('hello')).toEqual({source: 'hello'});
    expect(load('hello')).toEqual({source: 'hello'});
    expect(load('world')).toEqual({source: 'world'});
  });

  requests.expect(['ERROR_THIS', 'NOT_FOUND', 'NOT_DEFINED'], () => {
    expect(load('hello')).toEqual({source: 'hello'});
    expect(load('world')).toEqual({source: 'world'});
    expect(() => load('ERROR_THIS')).toThrow('Errored');
    expect(load('NOT_FOUND')).toBeNull();
    expect(load('NOT_DEFINED')).toBeUndefined();
  });

  requests.expect(['ERROR_THIS', 'NOT_DEFINED'], () => {
    expect(load('hello')).toEqual({source: 'hello'});
    expect(load('world')).toEqual({source: 'world'});
    expect(() => load('ERROR_THIS')).toThrow('Errored');
    expect(load('NOT_FOUND')).toBeNull();
    expect(load('NOT_DEFINED')).toBeUndefined();
  });

  expect(load.cache.get('hello')).toEqual({source: 'hello'});
  expect(load.cache.get('world')).toEqual({source: 'world'});

  load.cache.delete('hello');
  load.cache.set('world', {source: 'from set'});

  requests.expect(['hello'], () => {
    expect(load('hello')).toEqual({source: 'hello'});
    expect(load('world')).toEqual({source: 'from set'});
  });

  load.cache.clear();
  requests.expect(['hello', 'world'], () => {
    expect(load('hello')).toEqual({source: 'hello'});
    expect(load('world')).toEqual({source: 'world'});
  });
});

test('dedupeSync - mapKey', () => {
  const requests = requestsTester<string>();
  const load = dedupeSync(
    ({id}: {id: string}) => {
      requests.add(id);
      if (id === 'ERROR_THIS') {
        throw new Error('Errored');
      }
      return {source: id};
    },
    {mapKey: (source) => source.id},
  );

  requests.expect([`hello`, `world`], () => {
    expect(load({id: 'hello'})).toEqual({source: 'hello'});
    expect(load({id: 'hello'})).toEqual({source: 'hello'});
    expect(load({id: 'world'})).toEqual({source: 'world'});
  });

  requests.expect([`ERROR_THIS`], () => {
    expect(load({id: 'hello'})).toEqual({source: 'hello'});
    expect(load({id: 'world'})).toEqual({source: 'world'});
    expect(() => load({id: 'ERROR_THIS'})).toThrow('Errored');
  });

  requests.expect([`ERROR_THIS`], () => {
    expect(load({id: 'hello'})).toEqual({source: 'hello'});
    expect(load({id: 'world'})).toEqual({source: 'world'});
    expect(() => load({id: 'ERROR_THIS'})).toThrow('Errored');
  });

  expect(load.cache.get({id: 'hello'})).toEqual({source: 'hello'});
  expect(load.cache.get({id: 'world'})).toEqual({source: 'world'});

  load.cache.delete({id: 'hello'});
  load.cache.set({id: 'world'}, {source: 'from set'});

  requests.expect(['hello'], () => {
    expect(load({id: 'hello'})).toEqual({source: 'hello'});
    expect(load({id: 'world'})).toEqual({source: 'from set'});
  });

  load.cache.clear();
  requests.expect(['hello', 'world'], () => {
    expect(load({id: 'hello'})).toEqual({source: 'hello'});
    expect(load({id: 'world'})).toEqual({source: 'world'});
  });
});

test('dedupeSync - shouldCache', () => {
  const requests = requestsTester<string>();
  const load = dedupeSync(
    (source: string) => {
      requests.add(source);
      if (source === 'ERROR_THIS') {
        throw new Error('Errored');
      }
      if (source === 'NOT_FOUND') {
        return null;
      }
      return {source};
    },
    {shouldCache: (v) => v !== null},
  );

  requests.expect(['hello', 'world'], () => {
    expect(load('hello')).toEqual({source: 'hello'});
    expect(load('hello')).toEqual({source: 'hello'});
    expect(load('world')).toEqual({source: 'world'});
  });

  requests.expect(['ERROR_THIS', 'NOT_FOUND'], () => {
    expect(load('hello')).toEqual({source: 'hello'});
    expect(load('world')).toEqual({source: 'world'});
    expect(() => load('ERROR_THIS')).toThrow('Errored');
    expect(load('NOT_FOUND')).toBeNull();
  });

  requests.expect(['ERROR_THIS', 'NOT_FOUND'], () => {
    expect(load('hello')).toEqual({source: 'hello'});
    expect(load('world')).toEqual({source: 'world'});
    expect(() => load('ERROR_THIS')).toThrow('Errored');
    expect(load('NOT_FOUND')).toBeNull();
  });
});

test('dedupeSync - WeakMap', () => {
  const requests = requestsTester<string>();
  const load = dedupeSync(
    ({id}: {id: string}) => {
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

  requests.expect([`hello`, `world`], () => {
    expect(load(HELLO_REQUEST)).toEqual({source: 'hello'});
    expect(load(HELLO_REQUEST)).toEqual({source: 'hello'});
    expect(load(WORLD_REQUEST)).toEqual({source: 'world'});
  });

  requests.expect([`ERROR_THIS`], () => {
    expect(load(HELLO_REQUEST)).toEqual({source: 'hello'});
    expect(load(WORLD_REQUEST)).toEqual({source: 'world'});
    expect(() => load(ERROR_REQUEST)).toThrow('Errored');
  });

  requests.expect([`ERROR_THIS`], () => {
    expect(load(HELLO_REQUEST)).toEqual({source: 'hello'});
    expect(load(WORLD_REQUEST)).toEqual({source: 'world'});
    expect(() => load(ERROR_REQUEST)).toThrow('Errored');
  });

  expect(load.cache.get(HELLO_REQUEST)).toEqual({source: 'hello'});
  expect(load.cache.get(WORLD_REQUEST)).toEqual({source: 'world'});

  load.cache.delete(HELLO_REQUEST);
  load.cache.set(WORLD_REQUEST, {source: 'from set'});

  requests.expect(['hello'], () => {
    expect(load(HELLO_REQUEST)).toEqual({source: 'hello'});
    expect(load(WORLD_REQUEST)).toEqual({source: 'from set'});
  });

  expect(() => load.cache.clear()).toThrow(
    `This cache does not support clearing`,
  );
  requests.expect([], () => {
    expect(load(HELLO_REQUEST)).toEqual({source: 'hello'});
    expect(load(WORLD_REQUEST)).toEqual({source: 'from set'});
  });
});
