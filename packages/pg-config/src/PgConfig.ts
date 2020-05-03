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
   * Set this to a volume name to automatically
   * persist data to a docker volume of that name.
   *
   * N.B. this will automatically remove "-ram"
   * from the end of any image name.
   */
  persistVolume?: string;
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
interface PgConfig {
  /**
   * The environment variable containing the
   * connection string to the postgres database
   *
   * @default "DATABASE_URL"
   */
  connectionStringEnvironmentVariable: string;

  /**
   * Config for pg-test
   *
   * @default {}
   */
  test: TestConfig;
}

export default PgConfig;
