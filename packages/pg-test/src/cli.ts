#!/usr/bin/env node

import getDatabase, {stopDatabase} from '.';
import {readFileSync, writeFileSync} from 'fs';

if (
  process.argv[2] === 'help' ||
  process.argv.includes('--help') ||
  process.argv.includes('-h')
) {
  usage();
  process.exit(0);
}

const debug = process.argv.includes('--debug') ? true : undefined;
const containerName = process.argv.includes('--containerName')
  ? process.argv[process.argv.indexOf('--containerName') + 1]
  : undefined;

function get(key: string) {
  return process.argv.includes(key)
    ? process.argv[process.argv.indexOf(key) + 1]
    : undefined;
}
const command = process.argv[2];
switch (command) {
  case 'start':
    getDatabase({
      detached: true,
      debug,
      containerName,
      pgUser: get('--pgUser'),
      pgDb: get('--pgDb'),
      persistVolume: get('--persistVolume'),
      refreshImage: process.argv.includes('--refreshImage') ? true : undefined,
    })
      .then(result => {
        const envLine = 'DATABASE_URL=' + result.databaseURL;
        if (process.argv.includes('--writeEnv')) {
          console.info('Writing to .env');
          console.info('');
          console.info(envLine);
          try {
            let dotenv = readFileSync('.env', 'utf8');

            if (/^DATABASE_URL *=.*$/gm.test(dotenv)) {
              dotenv = dotenv.replace(/^DATABASE_URL *=.*$/gm, envLine);
            } else {
              dotenv += '\n' + envLine + '\n';
            }
            writeFileSync('.env', dotenv);
          } catch (ex) {
            if (ex.code !== 'ENOENT') {
              throw ex;
            }
            writeFileSync('.env', envLine + '\n');
          }
        } else {
          console.info(envLine);
        }
      })
      .catch(ex => {
        console.error(ex);
        process.exit(1);
      });
    break;
  case 'stop':
    stopDatabase({debug, containerName}).catch(ex => {
      console.error(ex);
      process.exit(1);
    });
    break;
  default:
    usage();
    process.exit(1);
    break;
}

function usage() {
  console.info('Usage: pg-test start');
  console.info('Usage: pg-test stop');
}
