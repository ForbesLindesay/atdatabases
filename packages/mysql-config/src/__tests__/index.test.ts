import {DEFAULT_CONFIG, getMySqlConfigSync, readMySqlConfigSync} from '..';

test('get root config', () => {
  expect(getMySqlConfigSync()).toEqual({
    connectionStringEnvironmentVariable: 'MYSQL_URL',
    test: {
      connectTimeoutSeconds: 20,
      containerName: 'mysql-test',
      debug: false,
      image: 'mysql:8.0.23',
      mySqlDb: 'test-db',
      mySqlPassword: 'password',
      mySqlUser: 'test-user',
    },
    types: DEFAULT_CONFIG.types,
  });
});

test('valid config', () => {
  expect(readMySqlConfigSync(__dirname + '/fixtures/empty.json')).toEqual({
    connectionStringEnvironmentVariable: 'DATABASE_URL',
    test: {
      connectTimeoutSeconds: 20,
      containerName: 'mysql-test',
      debug: false,
      image: 'mysql:8.0.23',
      mySqlDb: 'test-db',
      mySqlPassword: 'password',
      mySqlUser: 'test-user',
    },
    types: DEFAULT_CONFIG.types,
  });
  expect(readMySqlConfigSync(__dirname + '/fixtures/override.json')).toEqual({
    connectionStringEnvironmentVariable: 'PG_CONNECTION',
    test: {
      connectTimeoutSeconds: 20,
      containerName: 'mysql-test',
      debug: false,
      image: 'mysql:8.0.23',
      mySqlDb: 'test-db',
      mySqlPassword: 'password',
      mySqlUser: 'test-user',
    },
    types: DEFAULT_CONFIG.types,
  });
});

test('invalid config', () => {
  expect(() => readMySqlConfigSync(__dirname + '/fixtures/invalid.json'))
    .toThrowErrorMatchingInlineSnapshot(`
    "Unable to assign {connectionStringEnvironmentVariable: 10} to { connectionStringEnvironmentVariable: string | undefined; test: TestConfig | undefined; types: TypesConfig | undefined; }
      The types of \\"connectionStringEnvironmentVariable\\" are not compatible
        Unable to assign 10 to string | undefined
          Unable to assign 10 to string
            Expected string, but was 10
          And unable to assign 10 to undefined
            Expected literal undefined, but was 10 (i.e. a number)"
  `);
});
