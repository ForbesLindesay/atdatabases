// @public

import getDatabase, {run} from '../';

const DEFAULT_ENV_VAR = process.env.PG_JEST_ENV_VAR || 'DATABASE_URL';

export const killers: Array<() => Promise<void>> = [];

module.exports = async () => {
  let opts = {};
  if ((global as any)['pg-jest']) {
    opts = (global as any)['pg-jest'];
  }
  const envVar: string = (opts as any).environmentVariable || DEFAULT_ENV_VAR;
  const migrationsScript =
    (opts as any).migrationsScript ||
    (process.env.PG_JEST_MIGRATIONS_SCRIPT
      ? process.env.PG_JEST_MIGRATIONS_SCRIPT.split(' ')
      : undefined);
  if (process.env[envVar]) {
    console.info('Using existing database: ', process.env[envVar]);
    return;
  }
  const {databaseURL, kill} = await getDatabase(opts);
  process.env[envVar] = databaseURL;
  if (migrationsScript) {
    console.log('Running migrations');
    await run(migrationsScript[0], migrationsScript.slice(1), {
      debug: (opts as any).debug || false,
      name: migrationsScript.join(' '),
    });
  }
  killers.push(() => {
    delete process.env[envVar];
    return kill();
  });
};

module.exports.killers = killers;
