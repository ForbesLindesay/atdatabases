import {getMySqlConfigSync, _testReadMySqlConfigSync} from '..';

test('get root config', () => {
  expect(getMySqlConfigSync()).toMatchInlineSnapshot(`
Object {
  "connectionStringEnvironmentVariable": "MYSQL_URL",
  "test": Object {
    "connectTimeoutSeconds": 20,
    "containerName": "mysql-test",
    "debug": false,
    "image": "mysql:5.7.24",
    "mySqlDb": "test-db",
    "mySqlPassword": "password",
    "mySqlUser": "test-user",
  },
}
`);
});

test('valid config', () => {
  expect(_testReadMySqlConfigSync(__dirname + '/fixtures/empty.json'))
    .toMatchInlineSnapshot(`
Object {
  "connectionStringEnvironmentVariable": "DATABASE_URL",
  "test": Object {
    "connectTimeoutSeconds": 20,
    "containerName": "mysql-test",
    "debug": false,
    "image": "mysql:5.7.24",
    "mySqlDb": "test-db",
    "mySqlPassword": "password",
    "mySqlUser": "test-user",
  },
}
`);
  expect(_testReadMySqlConfigSync(__dirname + '/fixtures/override.json'))
    .toMatchInlineSnapshot(`
Object {
  "connectionStringEnvironmentVariable": "PG_CONNECTION",
  "test": Object {
    "connectTimeoutSeconds": 20,
    "containerName": "mysql-test",
    "debug": false,
    "image": "mysql:5.7.24",
    "mySqlDb": "test-db",
    "mySqlPassword": "password",
    "mySqlUser": "test-user",
  },
}
`);
});

test('invalid config', () => {
  expect(() => _testReadMySqlConfigSync(__dirname + '/fixtures/invalid.json'))
    .toThrowErrorMatchingInlineSnapshot(`
"MySqlConfig.connectionStringEnvironmentVariable should be string

{ connectionStringEnvironmentVariable: 10,
  test:
   { connectTimeoutSeconds: 20,
     containerName: 'mysql-test',
     debug: false,
     image: 'mysql:5.7.24',
     mySqlDb: 'test-db',
     mySqlPassword: 'password',
     mySqlUser: 'test-user' } }"
`);
});
