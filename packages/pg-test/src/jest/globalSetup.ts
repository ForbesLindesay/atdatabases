// @public

import getDatabase, {Options} from '../';
import {getPgConfigSync} from '@databases/pg-config';
import {spawnBuffered} from 'modern-spawn';

const config = getPgConfigSync();

const DEFAULT_ENV_VAR =
  process.env.PG_TEST_ENV_VAR || config.connectionStringEnvironmentVariable;

export const killers: Array<() => Promise<void>> = [];
export default async function setup(
  opts: Partial<Options> & {
    environmentVariable?: string;
    migrationsScript?: string[];
  } = {},
) {
  const envVar: string = opts.environmentVariable || DEFAULT_ENV_VAR;
  const migrationsScript =
    opts.migrationsScript ||
    (process.env.PG_TEST_MIGRATIONS_SCRIPT
      ? process.env.PG_TEST_MIGRATIONS_SCRIPT.split(' ')
      : config.test.migrationsScript);
  if (process.env[envVar]) {
    console.info(`Using existing pg database from: ${envVar}`);
    return;
  }
  const {databaseURL, kill} = await getDatabase(opts);
  console.info(`Setting pg connection string on environment: ${envVar}`);
  process.env[envVar] = databaseURL;
  if (migrationsScript) {
    console.info('Running pg migrations');
    await spawnBuffered(migrationsScript[0], migrationsScript.slice(1), {
      debug:
        opts.debug || (opts.debug === undefined && config.test.debug) || false,
    }).getResult();
  }
  killers.push(async () => {
    delete process.env[envVar];
    await kill();
  });
}

module.exports = setup;
module.exports.default = setup;
module.exports.killers = killers;
