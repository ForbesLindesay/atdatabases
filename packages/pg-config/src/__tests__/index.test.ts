import {getPgConfigSync, readPgConfigSync} from '..';

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
      ignoreEnumValues: {},
      ignoreTables: [],
      includeTables: null,
      primaryKeyFileName: '{{ TABLE_NAME }}.ts',
      primaryKeyTypeMode: 'inline_loose_brand',
      primaryKeyTypeName:
        '{{ TABLE_NAME | pascal-case }}_{{ COLUMN_NAME | pascal-case }}',
      schemaFileName: 'index.ts',
      schemaTypeName: 'DatabaseSchema',
      schemaJsonFileName: 'schema.json',
      serializeValueFileName: 'index.ts',
      serializeValueTypeName: 'serializeValue',
      tableFileName: '{{ TABLE_NAME }}.ts',
      tableReExportFileName: 'index.ts',
      tableInsertParametersReExportFileName: 'index.ts',
      tableInsertParametersFileName: '{{ TABLE_NAME }}.ts',
      tableInsertParametersTypeName:
        '{{ TABLE_NAME | pascal-case }}_InsertParameters',
      tableTypeName: '{{ TABLE_NAME | pascal-case }}',
      columnTypeOverrides: {},
      typeOverrides: {},
      requireExplicitDefaults: false,
    },
  });
});

test('valid config', () => {
  expect(readPgConfigSync(__dirname + '/fixtures/empty.json')).toEqual({
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
      ignoreEnumValues: {},
      ignoreTables: [],
      includeTables: null,
      primaryKeyFileName: '{{ TABLE_NAME }}.ts',
      primaryKeyTypeMode: 'inline_loose_brand',
      primaryKeyTypeName:
        '{{ TABLE_NAME | pascal-case }}_{{ COLUMN_NAME | pascal-case }}',
      schemaFileName: 'index.ts',
      schemaTypeName: 'DatabaseSchema',
      schemaJsonFileName: 'schema.json',
      serializeValueFileName: 'index.ts',
      serializeValueTypeName: 'serializeValue',
      tableFileName: '{{ TABLE_NAME }}.ts',
      tableReExportFileName: 'index.ts',
      tableInsertParametersReExportFileName: 'index.ts',
      tableInsertParametersFileName: '{{ TABLE_NAME }}.ts',
      tableInsertParametersTypeName:
        '{{ TABLE_NAME | pascal-case }}_InsertParameters',
      tableTypeName: '{{ TABLE_NAME | pascal-case }}',
      columnTypeOverrides: {},
      typeOverrides: {},
      requireExplicitDefaults: false,
    },
  });
  expect(readPgConfigSync(__dirname + '/fixtures/override.json')).toEqual({
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
      ignoreEnumValues: {},
      ignoreTables: [],
      includeTables: null,
      primaryKeyFileName: '{{ TABLE_NAME }}.ts',
      primaryKeyTypeMode: 'inline_loose_brand',
      primaryKeyTypeName:
        '{{ TABLE_NAME | pascal-case }}_{{ COLUMN_NAME | pascal-case }}',
      schemaFileName: 'index.ts',
      schemaTypeName: 'DatabaseSchema',
      schemaJsonFileName: 'schema.json',
      serializeValueFileName: 'index.ts',
      serializeValueTypeName: 'serializeValue',
      tableFileName: '{{ TABLE_NAME }}.ts',
      tableReExportFileName: 'index.ts',
      tableInsertParametersReExportFileName: 'index.ts',
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
      requireExplicitDefaults: false,
    },
  });
});

test('invalid config', () => {
  expect(() => readPgConfigSync(__dirname + '/fixtures/invalid.json'))
    .toThrowErrorMatchingInlineSnapshot(`
    "Unable to assign {connectionStringEnvironmentVariable: 10} to { connectionStringEnvironmentVariable: string | undefined; migrationsDirectory: string | undefined; test: TestConfig | undefined; types: TypesConfig | undefined; }
      The types of \\"connectionStringEnvironmentVariable\\" are not compatible
        Unable to assign 10 to string | undefined
          Unable to assign 10 to string
            Expected string, but was 10
          And unable to assign 10 to undefined
            Expected literal undefined, but was 10 (i.e. a number)"
  `);
});
