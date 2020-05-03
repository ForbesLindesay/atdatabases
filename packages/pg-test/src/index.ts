import startContainer, {
  Options as WithContainerOptions,
  killOldContainers,
} from '@databases/with-container';
import {getPgConfigSync} from '@databases/pg-config';

const config = getPgConfigSync();
const DEFAULT_PG_DEBUG = !!process.env.PG_TEST_DEBUG || config.test.debug;
const DEFAULT_IMAGE = process.env.PG_TEST_IMAGE || config.test.image;
const DEFAULT_CONTAINER_NAME =
  process.env.PG_TEST_CONTAINER_NAME || config.test.containerName;
if (
  process.env.PG_TEST_CONNECT_TIMEOUT_SECONDS &&
  !/^\d+$/.test(process.env.PG_TEST_CONNECT_TIMEOUT_SECONDS)
) {
  throw new Error(
    'Expected PG_TEST_CONNECT_TIMEOUT_SECONDS environment variable to be a positive integer',
  );
}
const DEFAULT_CONNECT_TIMEOUT_SECONDS = process.env
  .PG_TEST_CONNECT_TIMEOUT_SECONDS
  ? parseInt(process.env.PG_TEST_CONNECT_TIMEOUT_SECONDS, 10)
  : config.test.connectTimeoutSeconds;
const DEFAULT_PG_PORT = 5432;
const DEFAULT_PG_USER = process.env.PG_TEST_USER || config.test.pgUser;
const DEFAULT_PG_DB = process.env.PG_TEST_DB || config.test.pgDb;

export interface Options
  extends Pick<
    WithContainerOptions,
    Exclude<keyof WithContainerOptions, 'internalPort'>
  > {
  pgUser: string;
  pgDb: string;
}

export async function killDatabase(options: Partial<Options> = {}) {
  await killOldContainers({
    debug: DEFAULT_PG_DEBUG,
    containerName: DEFAULT_CONTAINER_NAME,
    ...options,
  });
}

export default async function getDatabase(options: Partial<Options> = {}) {
  const {pgUser, pgDb, environment, ...rawOptions}: Options = {
    debug: DEFAULT_PG_DEBUG,
    image: DEFAULT_IMAGE,
    containerName: DEFAULT_CONTAINER_NAME,
    connectTimeoutSeconds: DEFAULT_CONNECT_TIMEOUT_SECONDS,
    pgUser: DEFAULT_PG_USER,
    pgDb: DEFAULT_PG_DB,
    defaultExternalPort: DEFAULT_PG_PORT,
    externalPort: config.test.port,
    ...options,
  };

  const {proc, externalPort, kill} = await startContainer({
    ...rawOptions,
    internalPort: DEFAULT_PG_PORT,
    environment: {...environment, POSTGRES_USER: pgUser, POSTGRES_DB: pgDb},
  });

  const databaseURL = `postgres://${pgUser}@localhost:${externalPort}/${pgDb}`;

  return {
    proc,
    databaseURL,
    kill,
  };
}
