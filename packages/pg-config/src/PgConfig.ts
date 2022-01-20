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
   * using @databases/pg-test
   *
   * @default "postgres:10.6-alpine"
   */
  image: string;
  /**
   * The default name to give the docker
   * containers run by @database/pg-test
   *
   * @default "pg-test"
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
   * The port to run postgres on when running docker
   * for tests. Defaults to 5432 or the first available
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
  pgUser: string;
  /**
   * The db to create in the test docker container
   *
   * @default "test-db"
   */
  pgDb: string;
}

export const TestConfigSchema: ft.Runtype<TestConfig> = ft
  .Object({
    debug: withDefault(ft.Boolean, false),
    migrationsScript: ft.Union(ft.String, ft.Array(ft.String), ft.Undefined),
    image: withDefault(ft.String, `postgres:10.6-alpine`),
    containerName: withDefault(ft.String, `pg-test`),
    connectTimeoutSeconds: withDefault(integer({min: 0}), 20),
    port: withDefault(integer({min: 0, max: 65535}), undefined),
    pgUser: withDefault(ft.String, `test-user`),
    pgDb: withDefault(ft.String, `test-db`),
  })
  .withConstraint((value) => true, {name: `TestConfig`});

export enum PgTypesDomainTypeMode {
  strict_brand = 'strict_brand',
  loose_brand = 'loose_brand',
  alias = 'alias',
  inline = 'inline',
}
export enum PgTypesEnumTypeMode {
  enum = 'enum',
  union_alias = 'union_alias',
  union_alias_with_object = 'union_alias_with_object',
  inline = 'inline',
}
export enum PgTypesPrimaryKeyTypeMode {
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
   * What should be generated for custom types with constraints?
   *
   * @default "loose_brand"
   */
  domainTypeMode: PgTypesDomainTypeMode;
  /**
   * What should custom types be called (ignored for domainTypeMode="inline")
   *
   * @default "{{ TYPE_NAME | pascal-case }}"
   */
  domainTypeName: string;
  /**
   * Where should generated types for domains be put (ignored for domainTypeMode="inline")
   *
   * @default "_custom_types.ts"
   */
  domainFileName: string;

  /**
   * How should Postgres enums be represented in TypeScript?
   *
   * @default "union_alias"
   */
  enumTypeMode: 'enum' | 'union_alias' | 'union_alias_with_object' | 'inline';
  /**
   * What should enums be called (ignored for enumTypeMode="inline")
   *
   * @default "{{ TYPE_NAME | pascal-case }}"
   */
  enumTypeName: string;
  /**
   * Where should generated types for enums be put (ignored for enumTypeMode="inline")
   *
   * @default "_enums.ts"
   */
  enumFileName: string;

  /**
   * Do you want to use branded types for primary keys?
   *
   * @default "inline_loose_brand"
   */
  primaryKeyTypeMode:
    | 'strict_brand'
    | 'loose_brand'
    | 'inline_strict_brand'
    | 'inline_loose_brand'
    | 'inline_no_brand';
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
   * Also re-export the table record type from this file.
   * Set this to `null` or to the same value as `tableFileName`
   * to disable this feature.
   *
   * @default "index.ts"
   */
  tableReExportFileName: string | null;

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
   * Also re-export the table insert parameters type from this file.
   * Set this to `null` or to the same value as `tableFileName`
   * to disable this feature.
   *
   * @default "index.ts"
   */
  tableInsertParametersReExportFileName: string | null;

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
   * What filename do you want to use for the generated "schema" object.
   *
   * Set this explicitly to `null` to prevent this file being written.
   *
   * @default "schema.json"
   */
  schemaJsonFileName: string | null;

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
   * Override generated TypeScript types for some types. The name can be either:
   *
   * - key of @databases/pg-data-type-id (e.g. "json")
   * - value of @databases/pg-data-type-id (e.g. 114)
   * - "custom_type_name"
   * - "schema_name.custom_type_name"
   *
   * @default {}
   */
  typeOverrides: {[x: string]: string | undefined};
}

export const TypesConfigSchema: ft.Runtype<TypesConfig> = ft
  .Object({
    directory: withDefault(ft.String, `__generated__`),
    domainTypeMode: withDefault(
      ft.Enum(`PgTypesDomainTypeMode`, PgTypesDomainTypeMode),
      PgTypesDomainTypeMode.loose_brand,
    ),
    domainTypeName: withDefault(ft.String, `{{ TYPE_NAME | pascal-case }}`),
    domainFileName: withDefault(ft.String, `_custom_types.ts`),
    enumTypeMode: withDefault(
      ft.Enum(`PgTypesEnumTypeMode`, PgTypesEnumTypeMode),
      PgTypesEnumTypeMode.union_alias,
    ),
    enumTypeName: withDefault(ft.String, `{{ TYPE_NAME | pascal-case }}`),
    enumFileName: withDefault(ft.String, `_enums.ts`),
    primaryKeyTypeMode: withDefault(
      ft.Enum(`PgTypesPrimaryKeyTypeMode`, PgTypesPrimaryKeyTypeMode),
      PgTypesPrimaryKeyTypeMode.inline_loose_brand,
    ),
    primaryKeyTypeName: withDefault(
      ft.String,
      `{{ TABLE_NAME | pascal-case }}_{{ COLUMN_NAME | pascal-case }}`,
    ),
    primaryKeyFileName: withDefault(ft.String, `{{ TABLE_NAME }}.ts`),
    tableTypeName: withDefault(ft.String, `{{ TABLE_NAME | pascal-case }}`),
    tableFileName: withDefault(ft.String, `{{ TABLE_NAME }}.ts`),
    tableReExportFileName: withDefault(
      ft.Union(ft.String, ft.Null),
      'index.ts',
    ),
    tableInsertParametersTypeName: withDefault(
      ft.String,
      `{{ TABLE_NAME | pascal-case }}_InsertParameters`,
    ),
    tableInsertParametersFileName: withDefault(
      ft.String,
      `{{ TABLE_NAME }}.ts`,
    ),
    tableInsertParametersReExportFileName: withDefault(
      ft.Union(ft.String, ft.Null),
      'index.ts',
    ),
    schemaTypeName: withDefault(ft.String, `DatabaseSchema`),
    schemaFileName: withDefault(ft.String, `index.ts`),
    schemaJsonFileName: withDefault(
      ft.Union(ft.String, ft.Null),
      `schema.json`,
    ),
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

interface PgConfig {
  /**
   * The environment variable containing the
   * connection string to the postgres database
   *
   * @default "DATABASE_URL"
   */
  connectionStringEnvironmentVariable: string;

  /**
   * The directory containing migrations (when using @databases/pg-migrations)
   */
  migrationsDirectory?: string;

  /**
   * Config for pg-test
   *
   * @default {}
   */
  test: TestConfig;

  /**
   * Config for pg-schema-print-types
   *
   * @default {}
   */
  types: TypesConfig;
}

export const PgConfigSchema: ft.Runtype<PgConfig> = ft.Object({
  connectionStringEnvironmentVariable: withDefault(ft.String, `DATABASE_URL`),
  migrationsDirectory: withDefault(ft.String, undefined),
  test: withDefault(TestConfigSchema, TestConfigSchema.parse({})),
  types: withDefault(TypesConfigSchema, TypesConfigSchema.parse({})),
});

export default PgConfig;
