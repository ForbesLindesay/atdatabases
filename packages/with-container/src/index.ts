import {connect} from 'net';
import spawn = require('cross-spawn');
import {spawnBuffered} from 'modern-spawn';

export const detectPort: (
  defaultPort: number,
) => Promise<number> = require('detect-port');

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
  mount?: ReadonlyArray<{
    type: 'bind' | 'volume' | 'tmpfs';
    src: string;
    dst: string;
    readonly?: boolean;
  }>;
}

export interface NormalizedOptions
  extends Pick<Options, Exclude<keyof Options, 'defaultExternalPort'>> {
  detached: boolean;
  externalPort: number;
}

export async function imageExists(
  options: NormalizedOptions | Options,
): Promise<boolean> {
  const stdout = await spawnBuffered(
    'docker',
    ['images', '--format', '{{json .}}'],
    {
      debug: options.debug,
    },
  ).getResult('utf8');
  const existingImages = stdout
    .trim()
    .split('\n')
    .map((str) => {
      try {
        return JSON.parse(str);
      } catch (ex) {
        console.warn('Unable to parse: ' + str);
        return null;
      }
    })
    .filter((n) => n != null);
  const [Repository, Tag] = options.image.split(':');
  return existingImages.some(
    (i) => i.Repository === Repository && (!Tag || i.Tag === Tag),
  );
}
export async function pullDockerImage(options: NormalizedOptions | Options) {
  if (
    !options.refreshImage &&
    /.+\:.+/.test(options.image) &&
    (await imageExists(options))
  ) {
    console.warn(
      options.image +
        ' already pulled (use mysql-test start --refresh or ops.refreshImage to refresh)',
    );
    return;
  }
  console.warn('Pulling Docker Image ' + options.image);
  await spawnBuffered('docker', ['pull', options.image], {
    debug: options.debug,
  }).getResult();
}

export function startDockerContainer(options: NormalizedOptions) {
  const env = options.environment || {};
  const envArgs: string[] = [];
  Object.keys(env).forEach((key) => {
    envArgs.push('--env');
    envArgs.push(`${key}=${env[key]}`);
  });
  const mounts: string[] = [];
  (options.mount || []).forEach(mount => {
    mounts.push('--mount');
    mounts.push(
      `type=${mount.type},source=${mount.src},target=${mount.dst}${
        mount.readonly ? `,readonly` : ``
      }`,
    );
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
      ...mounts,
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
          `Unable to connect to database after ${options.connectTimeoutSeconds} seconds. To view logs, run with DEBUG_PG_DOCKER=true environment variable`,
        ),
      );
    }, options.connectTimeoutSeconds * 1000);
    function test() {
      console.warn(
        `Waiting for ${options.containerName} on port ${options.externalPort}...`,
      );
      let currentTestFinished = false;
      const connection = connect(options.externalPort)
        .on('error', () => {
          if (finished || currentTestFinished) return;
          currentTestFinished = true;
          setTimeout(test, 500);
        })
        .on('end', () => {
          if (finished || currentTestFinished) return;
          currentTestFinished = true;
          setTimeout(test, 500);
        })
        .on('close', () => {
          if (finished || currentTestFinished) return;
          currentTestFinished = true;
          setTimeout(test, 500);
        })
        .on('connect', () => {
          setTimeout(() => {
            if (finished || currentTestFinished) return;
            finished = true;
            currentTestFinished = true;
            clearTimeout(timeout);
            connection.end();
            resolve();
          }, 2000);
        });
    }
    test();
  });
}

export async function killOldContainers(
  options: Pick<NormalizedOptions, 'debug' | 'containerName'>,
) {
  await spawnBuffered('docker', ['kill', options.containerName], {
    debug: options.debug,
  }); // do not check exit code as there may not be a container to kill
  await spawnBuffered('docker', ['rm', options.containerName], {
    debug: options.debug,
  }); // do not check exit code as there may not be a container to remove
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

  console.warn('Starting Docker Container ' + opts.containerName);
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
