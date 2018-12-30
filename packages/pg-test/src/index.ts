import startContainer, {
  run,
  Options as WithContainerOptions,
} from '@databases/with-container';

const DEFAULT_PG_DEBUG = !!process.env.PG_TEST_DEBUG;
const DEFAULT_IMAGE =
  process.env.PG_TEST_IMAGE || 'circleci/postgres:10.6-alpine-ram';
const DEFAULT_CONTAINER_NAME = process.env.PG_TEST_CONTAINER_NAME || 'pg-test';
const DEFAULT_CONNECT_TIMEOUT_SECONDS = process.env
  .PG_TEST_CONNECT_TIMEOUT_SECONDS
  ? parseInt(process.env.PG_TEST_CONNECT_TIMEOUT_SECONDS, 10)
  : 20;
const DEFAULT_PG_PORT = 5432;
const DEFAULT_PG_USER = process.env.PG_TEST_USER || 'test-user';
const DEFAULT_PG_DB = process.env.PG_TEST_DB || 'test-db';

interface Options
  extends Pick<
    WithContainerOptions,
    Exclude<keyof WithContainerOptions, 'internalPort'>
  > {
  pgUser: string;
  pgDb: string;
}

export {run};

export default async function getDatabase(options: Partial<Options> = {}) {
  const {pgUser, pgDb, environment, ...rawOptions}: Options = {
    debug: DEFAULT_PG_DEBUG,
    image: DEFAULT_IMAGE,
    containerName: DEFAULT_CONTAINER_NAME,
    connectTimeoutSeconds: DEFAULT_CONNECT_TIMEOUT_SECONDS,
    pgUser: DEFAULT_PG_USER,
    pgDb: DEFAULT_PG_DB,
    defaultExternalPort: DEFAULT_PG_PORT,
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
