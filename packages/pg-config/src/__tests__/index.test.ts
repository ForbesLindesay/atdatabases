import {getPgConfigSync, _testReadPgConfigSync} from '..';

test('get root config', () => {
  expect(getPgConfigSync()).toMatchInlineSnapshot(`
Object {
  "connectionStringEnvironmentVariable": "PG_URL",
  "test": Object {
    "connectTimeoutSeconds": 20,
    "containerName": "pg-test",
    "debug": false,
    "image": "circleci/postgres:10.6-alpine-ram",
    "pgDb": "test-db",
    "pgUser": "test-user",
  },
}
`);
});

test('valid config', () => {
  expect(_testReadPgConfigSync(__dirname + '/fixtures/empty.json'))
    .toMatchInlineSnapshot(`
Object {
  "connectionStringEnvironmentVariable": "DATABASE_URL",
  "test": Object {
    "connectTimeoutSeconds": 20,
    "containerName": "pg-test",
    "debug": false,
    "image": "circleci/postgres:10.6-alpine-ram",
    "pgDb": "test-db",
    "pgUser": "test-user",
  },
}
`);
  expect(_testReadPgConfigSync(__dirname + '/fixtures/override.json'))
    .toMatchInlineSnapshot(`
Object {
  "connectionStringEnvironmentVariable": "PG_CONNECTION",
  "test": Object {
    "connectTimeoutSeconds": 20,
    "containerName": "pg-test",
    "debug": false,
    "image": "circleci/postgres:10.6-alpine-ram",
    "pgDb": "test-db",
    "pgUser": "test-user",
  },
}
`);
});

test('invalid config', () => {
  expect(() => _testReadPgConfigSync(__dirname + '/fixtures/invalid.json'))
    .toThrowErrorMatchingInlineSnapshot(`
"PgConfig.connectionStringEnvironmentVariable should be string
PgConfig value:

{ connectionStringEnvironmentVariable: 10,
  test:
   { connectTimeoutSeconds: 20,
     containerName: 'pg-test',
     debug: false,
     image: 'circleci/postgres:10.6-alpine-ram',
     pgDb: 'test-db',
     pgUser: 'test-user' } }"
`);
});
