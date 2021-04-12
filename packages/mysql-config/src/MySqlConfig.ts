import * as ft from 'funtypes';

function withDefault<TValue, TDefault>(
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
   * using @databases/mysql-test. When I
   * tried using the ream image it didn't
   * work very well.
   *
   * @default "mysql:5.7.24"
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
    image: withDefault(ft.String, `mysql:5.7.24`),
    containerName: withDefault(ft.String, `mysql-test`),
    connectTimeoutSeconds: withDefault(integer({min: 0}), 20),
    port: withDefault(integer({min: 0, max: 65535}), undefined),
    mySqlUser: withDefault(ft.String, `test-user`),
    mySqlPassword: withDefault(ft.String, `password`),
    mySqlDb: withDefault(ft.String, `test-db`),
  })
  .withConstraint((value) => true, {name: `TestConfig`});

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
}

export const MySqlConfigSchema: ft.Runtype<MySqlConfig> = ft.Object({
  connectionStringEnvironmentVariable: withDefault(ft.String, `DATABASE_URL`),
  test: withDefault(TestConfigSchema, TestConfigSchema.parse({})),
});

export default MySqlConfig;
