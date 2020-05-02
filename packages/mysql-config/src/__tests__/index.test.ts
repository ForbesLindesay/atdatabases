import {getMySqlConfigSync, _testReadMySqlConfigSync} from '..';

test('get root config', () => {
  expect(getMySqlConfigSync()).toEqual({
    connectionStringEnvironmentVariable: 'MYSQL_URL',
    test: {
      connectTimeoutSeconds: 20,
      containerName: 'mysql-test',
      debug: false,
      image: 'mysql:5.7.24',
      mySqlDb: 'test-db',
      mySqlPassword: 'password',
      mySqlUser: 'test-user',
    },
  });
});

test('valid config', () => {
  expect(_testReadMySqlConfigSync(__dirname + '/fixtures/empty.json')).toEqual({
    connectionStringEnvironmentVariable: 'DATABASE_URL',
    test: {
      connectTimeoutSeconds: 20,
      containerName: 'mysql-test',
      debug: false,
      image: 'mysql:5.7.24',
      mySqlDb: 'test-db',
      mySqlPassword: 'password',
      mySqlUser: 'test-user',
    },
  });
  expect(
    _testReadMySqlConfigSync(__dirname + '/fixtures/override.json'),
  ).toEqual({
    connectionStringEnvironmentVariable: 'PG_CONNECTION',
    test: {
      connectTimeoutSeconds: 20,
      containerName: 'mysql-test',
      debug: false,
      image: 'mysql:5.7.24',
      mySqlDb: 'test-db',
      mySqlPassword: 'password',
      mySqlUser: 'test-user',
    },
  });
});

test('invalid config', () => {
  expect(() =>
    _testReadMySqlConfigSync(__dirname + '/fixtures/invalid.json'),
  ).toThrowError(
    /MySqlConfig.connectionStringEnvironmentVariable should be string/,
  );
});
