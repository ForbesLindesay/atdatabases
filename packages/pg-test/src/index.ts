import {connect} from 'net';
import spawn = require('cross-spawn');
import run from './run';

const detectPort: (
  defaultPort: number,
) => Promise<number> = require('detect-port');

const DEFAULT_PG_DEBUG = !!process.env.PG_JEST_DEBUG;
const DEFAULT_IMAGE =
  process.env.PG_JEST_IMAGE || 'circleci/postgres:10.6-alpine-ram';
const DEFAULT_CONTAINER_NAME = process.env.PG_JEST_CONTAINER_NAME || 'pg-jest';
const DEFAULT_CONNECT_TIMEOUT_SECONDS = process.env
  .PG_JEST_CONNECT_TIMEOUT_SECONDS
  ? parseInt(process.env.PG_JEST_CONNECT_TIMEOUT_SECONDS, 10)
  : 20;
const DEFAULT_PG_PORT = 5432;
const DEFAULT_PG_USER = process.env.PG_JEST_USER || 'test-user';
const DEFAULT_PG_DB = process.env.PG_JEST_DB || 'test-db';

interface Options {
  debug: boolean;
  image: string;
  containerName: string;
  port: number;
  connectTimeoutSeconds: number;
  pgUser: string;
  pgDb: string;
}

export async function pullDockerImage(options: Options) {
  const {stdout} = await run('docker', ['images', '--format', '{{json .}}'], {
    debug: options.debug,
    name: 'docker images',
  });
  const existingImages = stdout
    .toString('utf8')
    .trim()
    .split('\n')
    .map(str => JSON.parse(str));
  const [Repository, Tag] = options.image.split(':');
  if (
    existingImages.some(
      i => i.Repository === Repository && (!Tag || i.Tag === Tag),
    )
  ) {
    console.log('Image already exists');
    return;
  }
  await run('docker', ['pull', options.image], {
    debug: options.debug,
    name: 'docker pull ' + JSON.stringify(options.image),
  });
}

export function startDockerContainer(options: Options) {
  return spawn(
    'docker',
    [
      'run',
      '--name',
      options.containerName,
      '-t', // terminate when sent SIGTERM
      '--rm', // automatically remove when container is killed
      '-p', // forward appropriate port
      `${options.port}:5432`,
      // set enviornment variables
      '--env',
      `POSTGRES_USER=${options.pgUser}`,
      '--env',
      `POSTGRES_DB=${options.pgDb}`,
      options.image,
    ],
    {
      stdio: options.debug ? 'inherit' : 'ignore',
    },
  );
}

export async function waitForDatabaseToStart(options: Options) {
  await new Promise(resolve => {
    let finished = false;
    const timeout = setTimeout(() => {
      finished = true;
      throw new Error(
        `Unable to connect to database after ${
          options.connectTimeoutSeconds
        } seconds. To view logs, run with DEBUG_PG_DOCKER=true environment variable`,
      );
    }, options.connectTimeoutSeconds * 1000);
    function test() {
      console.log(`Waiting for database on port ${options.port}...`);
      const connection = connect(options.port)
        .on('error', () => {
          if (finished) return;
          setTimeout(test, 500);
        })
        .on('connect', () => {
          finished = true;
          clearTimeout(timeout);
          connection.end();
          setTimeout(resolve, 2000);
        });
    }
    test();
  });
}

export async function killOldContainers(options: Options) {
  await run('docker', ['kill', options.containerName], {
    allowFailure: true, // kill fails if there is no container running
    debug: options.debug,
    name: 'docker kill ' + JSON.stringify(options.containerName),
  });
  await run('docker', ['rm', options.containerName], {
    allowFailure: true, // rm fails if there is no container running
    debug: options.debug,
    name: 'docker rm ' + JSON.stringify(options.containerName),
  });
}

export {run};

export default async function getDatabase(options: Partial<Options> = {}) {
  const opts: Options = {
    debug: DEFAULT_PG_DEBUG,
    image: DEFAULT_IMAGE,
    containerName: DEFAULT_CONTAINER_NAME,
    connectTimeoutSeconds: DEFAULT_CONNECT_TIMEOUT_SECONDS,
    pgUser: DEFAULT_PG_USER,
    pgDb: DEFAULT_PG_DB,
    port: options.port || (await detectPort(DEFAULT_PG_PORT)),
    ...options,
  };
  if (isNaN(opts.connectTimeoutSeconds)) {
    throw new Error('connectTimeoutSeconds must be a valid integer.');
  }

  console.log('Pulling Docker Image');
  await Promise.all([pullDockerImage(opts), killOldContainers(opts)]);

  console.log('Starting Docker Container');
  const proc = startDockerContainer(opts);

  await waitForDatabaseToStart(opts);

  const databaseURL = `postgres://${opts.pgUser}@localhost:${opts.port}/${
    opts.pgDb
  }`;

  return {
    proc,
    databaseURL,
    async kill() {
      try {
        await run('docker', ['kill', opts.containerName], {
          allowFailure: true,
          debug: opts.debug,
          name: 'docker kill ' + JSON.stringify(opts.containerName),
        });
      } catch (ex) {
        // ignore errors on teardown
      }
    },
  };
}
