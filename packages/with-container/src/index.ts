import {connect} from 'net';
import spawn = require('cross-spawn');
import run from './run';

export const detectPort: (
  defaultPort: number,
) => Promise<number> = require('detect-port');

export {run};

export interface Options {
  debug: boolean;
  image: string;
  containerName: string;
  defaultExternalPort: number;
  externalPort?: number;
  internalPort: number;
  connectTimeoutSeconds: number;
  environment?: {[key: string]: string};
  /**
   * By default, we check if the image already exists
   * before pulling it. We only pull if there is no
   * existing image. This is faster, but means we don't
   * get updates to the image.
   */
  refreshImage?: boolean;
  detached?: boolean;
}

export interface NormalizedOptions
  extends Pick<Options, Exclude<keyof Options, 'defaultExternalPort'>> {
  detached: boolean;
  externalPort: number;
}

export async function imageExists(
  options: NormalizedOptions | Options,
): Promise<boolean> {
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
  return existingImages.some(
    i => i.Repository === Repository && (!Tag || i.Tag === Tag),
  );
}
export async function pullDockerImage(options: NormalizedOptions | Options) {
  if (
    !options.refreshImage &&
    /.+\:.+/.test(options.image) &&
    (await imageExists(options))
  ) {
    console.info(
      options.image + ' already pulled (use ops.refreshImage to refresh)',
    );
    return;
  }
  console.info('Pulling Docker Image ' + options.image);
  await run('docker', ['pull', options.image], {
    debug: options.debug,
    name: 'docker pull ' + JSON.stringify(options.image),
  });
}

export function startDockerContainer(options: NormalizedOptions) {
  const env = options.environment || {};
  const envArgs: string[] = [];
  Object.keys(env).forEach(key => {
    envArgs.push('--env');
    envArgs.push(`${key}=${env[key]}`);
  });
  return spawn(
    'docker',
    [
      'run',
      '--name',
      options.containerName,
      '-t', // terminate when sent SIGTERM
      '--rm', // automatically remove when container is killed
      '-p', // forward appropriate port
      `${options.externalPort}:${options.internalPort}`,
      ...(options.detached ? ['--detach'] : []),
      // set enviornment variables
      ...envArgs,
      options.image,
    ],
    {
      stdio: options.debug ? 'inherit' : 'ignore',
    },
  );
}

export async function waitForDatabaseToStart(options: NormalizedOptions) {
  await new Promise<void>((resolve, reject) => {
    let finished = false;
    const timeout = setTimeout(() => {
      finished = true;
      reject(
        new Error(
          `Unable to connect to database after ${
            options.connectTimeoutSeconds
          } seconds. To view logs, run with DEBUG_PG_DOCKER=true environment variable`,
        ),
      );
    }, options.connectTimeoutSeconds * 1000);
    function test() {
      console.info(
        `Waiting for ${options.containerName} on port ${
          options.externalPort
        }...`,
      );
      const connection = connect(options.externalPort)
        .on('error', () => {
          if (finished) return;
          setTimeout(test, 500);
        })
        .on('connect', () => {
          finished = true;
          clearTimeout(timeout);
          connection.end();
          setTimeout(resolve, 1000);
        });
    }
    test();
  });
}

export async function killOldContainers(
  options: Pick<NormalizedOptions, 'debug' | 'containerName'>,
) {
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

export default async function startContainer(options: Options) {
  if (isNaN(options.connectTimeoutSeconds)) {
    throw new Error('connectTimeoutSeconds must be a valid integer.');
  }

  await Promise.all([pullDockerImage(options), killOldContainers(options)]);

  const {defaultExternalPort, ...rawOptions} = options;
  const externalPort =
    rawOptions.externalPort || (await detectPort(defaultExternalPort));
  if (typeof externalPort !== 'number') {
    throw new Error('Expected external port to be a number');
  }
  const opts: NormalizedOptions = {
    detached: false,
    ...rawOptions,
    externalPort,
  };

  console.info('Starting Docker Container ' + opts.containerName);
  const proc = startDockerContainer(opts);

  await waitForDatabaseToStart(opts);

  return {
    proc,
    externalPort,
    async kill() {
      await killOldContainers(options);
    },
  };
}
