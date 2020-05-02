import {getPgConfigSync, _testReadPgConfigSync} from '..';

test('get root config', () => {
  expect(getPgConfigSync()).toEqual({
    connectionStringEnvironmentVariable: 'PG_URL',
    test: {
      connectTimeoutSeconds: 20,
      containerName: 'pg-test',
      debug: false,
      image: 'postgres:10.6-alpine',
      pgDb: 'test-db',
      pgUser: 'test-user',
    },
  });
});

test('valid config', () => {
  expect(_testReadPgConfigSync(__dirname + '/fixtures/empty.json')).toEqual({
    connectionStringEnvironmentVariable: 'DATABASE_URL',
    test: {
      connectTimeoutSeconds: 20,
      containerName: 'pg-test',
      debug: false,
      image: 'postgres:10.6-alpine',
      pgDb: 'test-db',
      pgUser: 'test-user',
    },
  });
  expect(_testReadPgConfigSync(__dirname + '/fixtures/override.json')).toEqual({
    connectionStringEnvironmentVariable: 'PG_CONNECTION',
    test: {
      connectTimeoutSeconds: 20,
      containerName: 'pg-test',
      debug: false,
      image: 'postgres:10.6-alpine',
      pgDb: 'test-db',
      pgUser: 'test-user',
    },
  });
});

test('invalid config', () => {
  expect(() =>
    _testReadPgConfigSync(__dirname + '/fixtures/invalid.json'),
  ).toThrowError(
    /PgConfig.connectionStringEnvironmentVariable should be string/,
  );
});
