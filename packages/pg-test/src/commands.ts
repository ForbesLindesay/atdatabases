import ms = require('ms');
import {parse, startChain, param} from 'parameter-reducers';
import * as ta from 'type-assertions';
import {getPgConfigSync} from '@databases/pg-config';
import getDatabase, {Options, killDatabase} from '.';
import {execBuffered, spawnBuffered} from 'modern-spawn';

const seconds = <TName extends string>(keys: string[], name: TName) => {
  return param.parsedString(keys, name, (str, key) => {
    if (/^\d+$/.test(str)) {
      return {valid: true, value: parseInt(str, 10)};
    }
    try {
      const value = ms(str);
      if (value !== undefined) {
        return {valid: true, value: Math.round(value / 1000)};
      }
    } catch (ex) {
      // return default error message
    }
    return {
      valid: false,
      reason: `Expected ${key} to be a valid number of seconds`,
    };
  });
};

const params = startChain()
  .addParam(param.flag(['-d', '--debug'], 'debug'))
  .addParam(param.string(['--image'], 'image'))
  .addParam(param.string(['--containerName'], 'containerName'))
  .addParam(param.integer(['-p', '--externalPort'], 'externalPort'))
  .addParam(seconds(['--connectTimeout'], 'connectTimeoutSeconds'))
  .addParam(param.flag(['-r', '--refresh'], 'refreshImage'))

  .addParam(param.string(['--user'], 'pgUser'))
  .addParam(param.string(['--db'], 'pgDb'));

async function runMigrationsAndAddToEnv(databaseURL: string, debug?: boolean) {
  const config = getPgConfigSync();

  const DEFAULT_ENV_VAR =
    process.env.MYSQL_TEST_ENV_VAR ||
    config.connectionStringEnvironmentVariable;
  process.env[DEFAULT_ENV_VAR] = databaseURL;

  const migrationsScript = process.env.MYSQL_TEST_MIGRATIONS_SCRIPT
    ? process.env.MYSQL_TEST_MIGRATIONS_SCRIPT.split(' ')
    : config.test.migrationsScript;
  if (migrationsScript) {
    console.warn('Running pg migrations');
    if (typeof migrationsScript === 'string') {
      await execBuffered(migrationsScript, {
        debug: debug || config.test.debug || false,
      }).getResult();
    } else {
      await spawnBuffered(migrationsScript[0], migrationsScript.slice(1), {
        debug: debug || config.test.debug || false,
      }).getResult();
    }
  }
}

export async function start(args: string[]) {
  const parseResult = parse(params, args);
  if (!parseResult.valid) {
    console.error(parseResult.reason);
    return 1;
  }
  if (parseResult.rest.length) {
    console.error(`Unexpected option ${parseResult.rest[0]}`);
    return 1;
  }
  ta.assert<
    ta.Equal<
      Pick<
        Partial<Options>,
        | 'debug'
        | 'image'
        | 'containerName'
        | 'externalPort'
        | 'connectTimeoutSeconds'
        | 'refreshImage'
        | 'pgUser'
        | 'pgDb'
      > & {environmentVariable?: string},
      typeof parseResult.parsed
    >
  >();
  const {databaseURL} = await getDatabase({
    ...parseResult.parsed,
    detached: true,
  });

  await runMigrationsAndAddToEnv(databaseURL, parseResult.parsed.debug);

  console.info(databaseURL);
  return 0;
}

export async function run(args: string[]) {
  const parseResult = parse(params, args);
  if (!parseResult.valid) {
    console.error(parseResult.reason);
    return 1;
  }
  const rest =
    parseResult.rest[0] === '--' ? parseResult.rest.slice(1) : parseResult.rest;
  if (!rest.length) {
    console.error(`You must specify a command to run`);
    return 1;
  }
  const {databaseURL, kill} = await getDatabase({
    ...parseResult.parsed,
    detached: true,
  });

  await runMigrationsAndAddToEnv(databaseURL, parseResult.parsed.debug);

  const result = await spawnBuffered(
    parseResult.rest[0],
    parseResult.rest.slice(1),
    {
      debug: true,
    },
  );

  await kill();

  return result.status ?? 0;
}

const stopParams = startChain()
  .addParam(param.flag(['-d', '--debug'], 'debug'))
  .addParam(param.string(['--containerName'], 'containerName'));
export async function stop(args: string[]) {
  const parseResult = parse(stopParams, args);
  if (!parseResult.valid) {
    console.error(parseResult.reason);
    return 1;
  }
  if (parseResult.rest.length) {
    console.error(`Unexpected option ${parseResult.rest[0]}`);
    return 1;
  }
  ta.assert<
    ta.Equal<
      Pick<Partial<Options>, 'debug' | 'containerName'>,
      typeof parseResult.parsed
    >
  >();
  await killDatabase({
    ...parseResult.parsed,
    detached: true,
  });
  return 0;
}

// prettier-ignore
export function help(command?: string) {
  switch (command) {
    case 'start':
      console.info(`usage: pg-test start [-h] ...`);
      console.info(``);
      console.info(`Start temporary databases for running tests, using docker`);
      console.info(``);
      console.info(`Optional arguments:`);
      console.info(`  -d, --debug                  Print all the output of child commands.`);
      console.info(`  --image            <string>  Override the Postgres docker image.`);
      console.info(`  --containerName    <string>  Specify a custom name for the container.`);
      console.info(`  -p, --externalPort <integer> Specify the port to run on.`);
      console.info(`  --connectTimeout   <seconds> How long should we allow for the container`);
      console.info(`                               to start. You can specify a raw number in`);
      console.info(`                               seconds, or a time string like "1 minute"`);
      console.info(`  -r, --refresh                Update the cached docker conatiner`);
      console.info(`  --user              <string> The Postgres user`);
      console.info(`  --db                <string> The Postgres database`);
      console.info(`  -h, --help                   Show this help message and exit.`);
      break;
    case 'run':
      console.info(`usage: pg-test run <options> your-command`);
      console.info(``);
      console.info(`Run your command with a MySQL database that is disposed of when your command exits`);
      console.info(``);
      console.info(`Optional arguments:`);
      console.info(`  -d, --debug                  Print all the output of child commands.`);
      console.info(`  --image            <string>  Override the Postgres docker image.`);
      console.info(`  --containerName    <string>  Specify a custom name for the container.`);
      console.info(`  -p, --externalPort <integer> Specify the port to run on.`);
      console.info(`  --connectTimeout   <seconds> How long should we allow for the container`);
      console.info(`                               to start. You can specify a raw number in`);
      console.info(`                               seconds, or a time string like "1 minute"`);
      console.info(`  -r, --refresh                Update the cached docker conatiner`);
      console.info(`  --user              <string> The Postgres user`);
      console.info(`  --db                <string> The Postgres database`);
      console.info(`  -h, --help                   Show this help message and exit.`);
      break;
    case 'stop':
      console.info(`usage: pg-test stop [-h] ...`);
      console.info(``);
      console.info(`Stop temporary databases created via pg-test start`);
      console.info(``);
      console.info(`Optional arguments:`);
      console.info(`  -d, --debug                  Print all the output of child commands.`);
      console.info(`  --containerName    <string>  Specify a custom name for the container.`);
      break;
    default:
      console.info(`usage: pg-test <command> [-h] ...`);
      console.info(``);
      console.info(`Start temporary databases for running tests using docker`);
      console.info(``);
      console.info(`Commands`);
      console.info(`  start    Starts a Postgres database`);
      console.info(`  run      Run a command with a Postgres database that is disposed of at the end`);
      console.info(`  stop     Stops a Postgres database`);
      console.info(`  help     Print documentation for commands`);
      console.info(``);
      console.info(`Optional arguments:`);
      console.info(`  -h, --help     Show this help message and exit.`);
      console.info(``);
      console.info(`For detailed help about a specific command, use: pg-test help <command>`);
      break;
  }
}
