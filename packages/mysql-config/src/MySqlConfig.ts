import * as ft from 'funtypes';

function withDefault<TValue, TDefault = TValue>(
  type: ft.Runtype<TValue>,
  defaultValue: TDefault,
): ft.Runtype<TValue | TDefault> {
  return ft.Union(
    type,
    ft.Undefined.withParser({
      parse() {
        return {success: true, value: defaultValue};
      },
      name: `undefined`,
    }),
  );
}

function integer({
  min = -Math.pow(2, 31),
  max = Math.pow(2, 32),
}: {
  min?: number;
  max?: number;
}) {
  return ft.Number.withConstraint(
    (value) => {
      if (value !== Math.floor(value)) {
        return `Expected an integer but got ${value}`;
      }
      if (value < min || value > max) {
        return `Expected an integer between ${min} and ${max} but got ${value}`;
      }
      return true;
    },
    {name: `Integer`},
  );
}

export interface TestConfig {
  /**
   * Whether to output logs to stdout/stderr from docker
   * scripts.
   *
   * @default false
   */
  debug: boolean;
  /**
   * Optional script to run after the database
   * has been started but before running tests
   */
  migrationsScript?: string | string[];
  /**
   * The docker image to use when testing
   * using @databases/mysql-test.
   *
   * @default "mysql:8.0.23"
   */
  image: string;
  /**
   * The default name to give the docker
   * containers run by @database/mysql-test
   *
   * @default "mysql-test"
   */
  containerName: string;
  /**
   * The timeout in seconds when waiting for the test docker image to start
   *
   * @default 20
   * @minimum 0
   * @TJS-type integer
   */
  connectTimeoutSeconds: number;

  /**
   * The port to run mysql on when running docker
   * for tests. Defaults to 3306 or the first available
   * port after that.
   *
   * @minimum 0
   * @maximum 65535
   * @TJS-type integer
   */
  port?: number;

  /**
   * The user name to configure in the test docker container
   *
   * @default "test-user"
   */
  mySqlUser: string;
  /**
   * The password to configure in the test docker container
   *
   * @default "password"
   */
  mySqlPassword: string;
  /**
   * The db to create in the test docker container
   *
   * @default "test-db"
   */
  mySqlDb: string;
}

export const TestConfigSchema: ft.Runtype<TestConfig> = ft
  .Object({
    debug: withDefault(ft.Boolean, false),
    migrationsScript: ft.Union(ft.String, ft.Array(ft.String), ft.Undefined),
    image: withDefault(ft.String, `mysql:8.0.23`),
    containerName: withDefault(ft.String, `mysql-test`),
    connectTimeoutSeconds: withDefault(integer({min: 0}), 20),
    port: withDefault(integer({min: 0, max: 65535}), undefined),
    mySqlUser: withDefault(ft.String, `test-user`),
    mySqlPassword: withDefault(ft.String, `password`),
    mySqlDb: withDefault(ft.String, `test-db`),
  })
  .withConstraint((value) => true, {name: `TestConfig`});

export enum MySqlTypesPrimaryKeyTypeMode {
  strict_brand = 'strict_brand',
  loose_brand = 'loose_brand',
  inline_strict_brand = 'inline_strict_brand',
  inline_loose_brand = 'inline_loose_brand',
  inline_no_brand = 'inline_no_brand',
}

export interface TypesConfig {
  /**
   * The directory (relative to this config) to put the generated code in
   *
   * @default "__generated__"
   */
  directory: string;

  /**
   * Do you want to use branded types for primary keys?
   *
   * @default "inline_loose_brand"
   */
  primaryKeyTypeMode: MySqlTypesPrimaryKeyTypeMode;
  /**
   * What should types for primary keys be called (ignored for primaryKeyMode="inline_*")
   *
   * @default "{{ TABLE_NAME | pascal-case }}_{{ COLUMN_NAME | pascal-case }}"
   */
  primaryKeyTypeName: string;
  /**
   * Where should generated types for primary keys be put (ignored for primaryKeyMode="inline")
   *
   * @default "{{ TABLE_NAME }}.ts"
   */
  primaryKeyFileName: string;

  /**
   * What should TypeScript types for table records be called
   *
   * @default "{{ TABLE_NAME | pascal-case }}"
   */
  tableTypeName: string;
  /**
   * What filename do you want to use for tables
   *
   * @default "{{ TABLE_NAME }}.ts"
   */
  tableFileName: string;

  /**
   * What should TypeScript types for table insert parameters be called
   *
   * @default "{{ TABLE_NAME | pascal-case }}_InsertParameters"
   */
  tableInsertParametersTypeName: string;
  /**
   * What filename do you want to use for tables insert parameters
   *
   * @default "{{ TABLE_NAME }}.ts"
   */
  tableInsertParametersFileName: string;

  /**
   * What should the main generated "schema" type be called
   *
   * @default "DatabaseSchema"
   */
  schemaTypeName: string;
  /**
   * What filename do you want to use for the main generated "schema" type
   *
   * @default "index.ts"
   */
  schemaFileName: string;

  /**
   * What should the generated "serializeValue" function be called
   *
   * @default "serializeValue"
   */
  serializeValueTypeName: string;
  /**
   * What filename do you want to use for the generated "serializeValue" function
   *
   * @default "index.ts"
   */
  serializeValueFileName: string;

  /**
   * Override column types for some columns. The name can be either:
   *
   * - "table_name.column_name"
   * - "schema_name.table_name.column_name"
   *
   * @default {}
   */
  columnTypeOverrides: {[x: string]: string | undefined};

  /**
   * Override generated TypeScript types for some types.
   *
   * @default {}
   */
  typeOverrides: {[x: string]: string | undefined};
}

export const TypesConfigSchema: ft.Runtype<TypesConfig> = ft
  .Object({
    directory: withDefault(ft.String, `__generated__`),
    primaryKeyTypeMode: withDefault(
      ft.Enum(`MySqlTypesPrimaryKeyTypeMode`, MySqlTypesPrimaryKeyTypeMode),
      MySqlTypesPrimaryKeyTypeMode.inline_loose_brand,
    ),
    primaryKeyTypeName: withDefault(
      ft.String,
      `{{ TABLE_NAME | pascal-case }}_{{ COLUMN_NAME | pascal-case }}`,
    ),
    primaryKeyFileName: withDefault(ft.String, `{{ TABLE_NAME }}.ts`),
    tableTypeName: withDefault(ft.String, `{{ TABLE_NAME | pascal-case }}`),
    tableFileName: withDefault(ft.String, `{{ TABLE_NAME }}.ts`),
    tableInsertParametersTypeName: withDefault(
      ft.String,
      `{{ TABLE_NAME | pascal-case }}_InsertParameters`,
    ),
    tableInsertParametersFileName: withDefault(
      ft.String,
      `{{ TABLE_NAME }}.ts`,
    ),
    schemaTypeName: withDefault(ft.String, `DatabaseSchema`),
    schemaFileName: withDefault(ft.String, `index.ts`),
    serializeValueTypeName: withDefault(ft.String, `serializeValue`),
    serializeValueFileName: withDefault(ft.String, `index.ts`),

    columnTypeOverrides: withDefault<{[x: string]: string | undefined}>(
      ft.Record(ft.String, ft.String),
      {},
    ),
    typeOverrides: withDefault<{[x: string]: string | undefined}>(
      ft.Record(ft.String, ft.String),
      {},
    ),
  })
  .withConstraint((value) => true, {name: `TypesConfig`});

interface MySqlConfig {
  /**
   * The environment variable containing the
   * connection string to the mysql database
   *
   * @default "DATABASE_URL"
   */
  connectionStringEnvironmentVariable: string;

  /**
   * Config for mysql-test
   *
   * @default {}
   */
  test: TestConfig;

  /**
   * Config for mysql-schema-print-types
   *
   * @default {}
   */
  types: TypesConfig;
}

export const MySqlConfigSchema: ft.Runtype<MySqlConfig> = ft.Object({
  connectionStringEnvironmentVariable: withDefault(ft.String, `DATABASE_URL`),
  test: withDefault(TestConfigSchema, TestConfigSchema.parse({})),
  types: withDefault(TypesConfigSchema, TypesConfigSchema.parse({})),
});

export default MySqlConfig;
