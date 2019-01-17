import startContainer, {
  run,
  Options as WithContainerOptions,
  killOldContainers,
} from '@databases/with-container';
import {getMySqlConfigSync} from '@databases/mysql-config';

const config = getMySqlConfigSync();
const DEFAULT_MYSQL_DEBUG = !!process.env.MYSQL_TEST_DEBUG || config.test.debug;
const DEFAULT_IMAGE = process.env.MYSQL_TEST_IMAGE || config.test.image;
const DEFAULT_CONTAINER_NAME =
  process.env.MYSQL_TEST_CONTAINER_NAME || config.test.containerName;
if (
  process.env.MYSQL_TEST_CONNECT_TIMEOUT_SECONDS &&
  !/^\d+$/.test(process.env.MYSQL_TEST_CONNECT_TIMEOUT_SECONDS)
) {
  throw new Error(
    'Expected MYSQL_TEST_CONNECT_TIMEOUT_SECONDS environment variable to be a positive integer',
  );
}
const DEFAULT_CONNECT_TIMEOUT_SECONDS = process.env
  .MYSQL_TEST_CONNECT_TIMEOUT_SECONDS
  ? parseInt(process.env.MYSQL_TEST_CONNECT_TIMEOUT_SECONDS, 10)
  : config.test.connectTimeoutSeconds;
const DEFAULT_MYSQL_PORT = 3306;
const DEFAULT_MYSQL_USER = process.env.MYSQL_TEST_USER || config.test.mySqlUser;
const DEFAULT_MYSQL_PASSWORD =
  process.env.MYSQL_TEST_PASSWORD || config.test.mySqlPassword;
const DEFAULT_MYSQL_DB = process.env.MYSQL_TEST_DB || config.test.mySqlDb;

export interface Options
  extends Pick<
    WithContainerOptions,
    Exclude<keyof WithContainerOptions, 'internalPort'>
  > {
  mysqlUser: string;
  mysqlPassword: string;
  mysqlDb: string;
}

export {run};

export async function killDatabase(options: Partial<Options> = {}) {
  await killOldContainers({
    debug: DEFAULT_MYSQL_DEBUG,
    containerName: DEFAULT_CONTAINER_NAME,
    ...options,
  });
}
export default async function getDatabase(options: Partial<Options> = {}) {
  const {
    mysqlUser,
    mysqlPassword,
    mysqlDb,
    environment,
    ...rawOptions
  }: Options = {
    debug: DEFAULT_MYSQL_DEBUG,
    image: DEFAULT_IMAGE,
    containerName: DEFAULT_CONTAINER_NAME,
    connectTimeoutSeconds: DEFAULT_CONNECT_TIMEOUT_SECONDS,
    mysqlUser: DEFAULT_MYSQL_USER,
    mysqlPassword: DEFAULT_MYSQL_PASSWORD,
    mysqlDb: DEFAULT_MYSQL_DB,
    defaultExternalPort: DEFAULT_MYSQL_PORT,
    ...options,
  };

  const {proc, externalPort = config.test.port, kill} = await startContainer({
    ...rawOptions,
    internalPort: DEFAULT_MYSQL_PORT,
    environment: {
      MYSQL_ALLOW_EMPTY_PASSWORD: 'true',
      MYSQL_HOST: '127.0.0.1',
      MYSQL_ROOT_HOST: '%',
      ...environment,
      MYSQL_USER: mysqlUser,
      MYSQL_PASSWORD: mysqlPassword,
      MYSQL_DATABASE: mysqlDb,
    },
  });

  await new Promise<void>(resolve => setTimeout(resolve, 4000));

  const databaseURL = `mysql://${mysqlUser}:${mysqlPassword}@localhost:${externalPort}/${mysqlDb}`;

  return {
    proc,
    databaseURL,
    kill,
  };
}
