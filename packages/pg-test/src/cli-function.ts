#!/usr/bin/env node

import getDatabase, {stopDatabase} from '.';
import {readFileSync, writeFileSync} from 'fs';
import stringToValidPort from './stringToValidPort';

export default async function call(args: string[]): Promise<number> {
  if (args[0] === 'help' || args.includes('--help') || args.includes('-h')) {
    usage();
    return 0;
  }

  const PORT_RANGE = [1024, 49151] as const;
  const debug = args.includes('--debug') ? true : undefined;
  function get(key: string) {
    return args.includes(key) ? args[args.indexOf(key) + 1] : undefined;
  }

  const persistVolume = get('--persistVolume');
  const containerName =
    get('--containerName') ||
    (persistVolume ? `pg-test-${persistVolume}` : undefined);

  const portStr = get('port');
  if (
    portStr &&
    (!/^\d+$/.test(portStr) ||
      portStr.length > PORT_RANGE[1].toString().length ||
      parseInt(portStr, 10) < PORT_RANGE[0] ||
      parseInt(portStr, 10) > PORT_RANGE[1])
  ) {
    console.error(
      `The port must be a valid integer between ${PORT_RANGE[0]} and ${PORT_RANGE[1]} (inclusive)`,
    );
    return 1;
  }

  const defaultExternalPort = portStr
    ? parseInt(portStr, 10)
    : persistVolume
    ? stringToValidPort(persistVolume, PORT_RANGE[0], PORT_RANGE[1])
    : undefined;

  const command = args[0];
  switch (command) {
    case 'start':
      const result = await getDatabase({
        detached: true,
        debug,
        containerName,
        pgUser: get('--pgUser'),
        pgDb: get('--pgDb'),
        persistVolume,
        externalPort: portStr ? defaultExternalPort : undefined,
        defaultExternalPort,
        refreshImage: args.includes('--refreshImage') ? true : undefined,
      });
      const envLine = 'DATABASE_URL=' + result.databaseURL;
      const writeEnv = get('--writeEnv');
      if (args.includes('--writeEnv')) {
        const envFile = writeEnv && writeEnv[0] !== '-' ? writeEnv : '.env';
        console.info('Writing to .env');
        console.info('');
        console.info(envLine);
        try {
          let dotenv = readFileSync(envFile, 'utf8');

          if (/^DATABASE_URL *=.*$/gm.test(dotenv)) {
            dotenv = dotenv.replace(/^DATABASE_URL *=.*$/gm, envLine);
          } else {
            dotenv += '\n' + envLine + '\n';
          }
          writeFileSync(envFile, dotenv);
        } catch (ex) {
          if (ex.code !== 'ENOENT') {
            throw ex;
          }
          writeFileSync(envFile, envLine + '\n');
        }
      } else {
        console.info(envLine);
      }
      return 0;
    case 'stop':
      await stopDatabase({debug, containerName});
      return 0;
    default:
      usage();
      return 1;
  }

  function usage() {
    console.info('Usage: pg-test start');
    console.info('Usage: pg-test stop');
  }
}
