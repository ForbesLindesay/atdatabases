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
  migrationsScript?: string[];
  /**
   * The docker image to use when testing
   * using @databases/mysql-test. When I
   * tried using the ream image it didn't
   * work very well.
   *
   * See https://github.com/mysqljs/mysql/pull/1962
   * for issues supporting mysql 8
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

export default MySqlConfig;
