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
  domainTypeMode: 'strict_brand' | 'loose_brand' | 'alias' | 'inline';
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
   * Override column types for some columns. The name can be either:
   *
   * - "table_name.column_name"
   * - "schema_name.table_name.column_name"
   *
   * @default {}
   */
  columnTypeOverrides: {[name: string]: string};

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
  typeOverrides: {[name: string]: string};
}

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

export default PgConfig;
