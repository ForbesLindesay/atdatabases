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
    types: {
      directory: '__generated__',
      domainFileName: '_custom_types.ts',
      domainTypeMode: 'loose_brand',
      domainTypeName: '{{ TYPE_NAME | pascal-case }}',
      enumFileName: '_enums.ts',
      enumTypeMode: 'union_alias',
      enumTypeName: '{{ TYPE_NAME | pascal-case }}',
      primaryKeyFileName: '{{ TABLE_NAME }}.ts',
      primaryKeyTypeMode: 'inline_loose_brand',
      primaryKeyTypeName:
        '{{ TABLE_NAME | pascal-case }}_{{ COLUMN_NAME | pascal-case }}',
      schemaFileName: 'index.ts',
      schemaTypeName: 'DatabaseSchema',
      tableFileName: '{{ TABLE_NAME }}.ts',
      tableInsertParametersFileName: '{{ TABLE_NAME }}.ts',
      tableInsertParametersTypeName:
        '{{ TABLE_NAME | pascal-case }}_InsertParameters',
      tableTypeName: '{{ TABLE_NAME | pascal-case }}',
      columnTypeOverrides: {},
      typeOverrides: {},
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
    types: {
      directory: '__generated__',
      domainFileName: '_custom_types.ts',
      domainTypeMode: 'loose_brand',
      domainTypeName: '{{ TYPE_NAME | pascal-case }}',
      enumFileName: '_enums.ts',
      enumTypeMode: 'union_alias',
      enumTypeName: '{{ TYPE_NAME | pascal-case }}',
      primaryKeyFileName: '{{ TABLE_NAME }}.ts',
      primaryKeyTypeMode: 'inline_loose_brand',
      primaryKeyTypeName:
        '{{ TABLE_NAME | pascal-case }}_{{ COLUMN_NAME | pascal-case }}',
      schemaFileName: 'index.ts',
      schemaTypeName: 'DatabaseSchema',
      tableFileName: '{{ TABLE_NAME }}.ts',
      tableInsertParametersFileName: '{{ TABLE_NAME }}.ts',
      tableInsertParametersTypeName:
        '{{ TABLE_NAME | pascal-case }}_InsertParameters',
      tableTypeName: '{{ TABLE_NAME | pascal-case }}',
      columnTypeOverrides: {},
      typeOverrides: {},
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
    types: {
      directory: '__generated__',
      domainFileName: '_custom_types.ts',
      domainTypeMode: 'loose_brand',
      domainTypeName: '{{ TYPE_NAME | pascal-case }}',
      enumFileName: '_enums.ts',
      enumTypeMode: 'union_alias',
      enumTypeName: '{{ TYPE_NAME | pascal-case }}',
      primaryKeyFileName: '{{ TABLE_NAME }}.ts',
      primaryKeyTypeMode: 'inline_loose_brand',
      primaryKeyTypeName:
        '{{ TABLE_NAME | pascal-case }}_{{ COLUMN_NAME | pascal-case }}',
      schemaFileName: 'index.ts',
      schemaTypeName: 'DatabaseSchema',
      tableFileName: '{{ TABLE_NAME }}.ts',
      tableInsertParametersFileName: '{{ TABLE_NAME }}.ts',
      tableInsertParametersTypeName:
        '{{ TABLE_NAME | pascal-case }}_InsertParameters',
      tableTypeName: '{{ TABLE_NAME | pascal-case }}',
      columnTypeOverrides: {
        'my_table.my_column': "string & {__brand?: 'email'}",
      },
      typeOverrides: {
        '114': 'unknown',
      },
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
