import {existsSync} from 'fs';
import {sync as rimraf} from 'rimraf';
import connect from '@databases/pg';
import sql from '@databases/sql';
import chalk from 'chalk';
import {spawn as nodeSpawn} from 'child_process';
const spawn: typeof nodeSpawn = require('cross-spawn');

function runCommand(
  command: string,
  args?: string[],
  allowFailure: boolean = false,
) {
  return new Promise<string>((resolve, reject) => {
    const output: {kind: 'stdout' | 'stderr'; chunk: string | Buffer}[] = [];
    let result = '';
    const proc = spawn(command, args, {
      stdio: 'pipe',
    });
    proc.stdout.on('data', chunk => {
      output.push({kind: 'stdout', chunk});
      result += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    });
    proc.stderr.on('data', chunk => {
      output.push({kind: 'stderr', chunk});
    });
    proc.on('error', reject);
    proc.on('exit', code => {
      if (code === 0) {
        resolve(result);
      } else if (allowFailure) {
        reject(
          new Error(
            output
              .map(c =>
                typeof c.chunk === 'string'
                  ? c.chunk
                  : c.chunk.toString('utf8'),
              )
              .join(''),
          ),
        );
      } else {
        output.forEach(c => process[c.kind].write(c.chunk));
        process.exit(code || 1);
      }
    });
  });
}

async function isWorking(dbConnection: string): Promise<boolean> {
  const db = connect(dbConnection);
  // if we can connect to the database, it already exists :-)
  try {
    await db.query(sql`SELECT 1 + 1 AS solution`);
    db.dispose();
    return true;
  } catch (ex) {
    db.dispose();
    return false;
  }
}

async function whenStarted<T>(fn: () => Promise<T>): Promise<T> {
  const timeout = Date.now() + 20 * 1000;
  while (Date.now() < timeout) {
    try {
      return await fn();
    } catch (ex) {
      if (!/the database system is starting up/.test(ex.message)) {
        throw ex;
      }
    }
  }
  return await fn();
}

export default async function run(
  dbConnection: string | undefined = process.env.DATABASE_URL,
) {
  if (!dbConnection) {
    console.warn(
      'You must set the DATABASE_URL envrionemnt variable in .env for databases to create the database.',
    );
    return;
  }
  if (await isWorking(dbConnection)) {
    return;
  }
  const match = /postgres\:\/\/([a-zA-Z0-9_\-]+)\@localhost\/([a-zA-Z0-9_\-]+)/.exec(
    dbConnection,
  );
  if (!match) {
    console.warn(
      'Unable to connect to the database: ' + chalk.cyan(dbConnection),
    );
    console.warn(
      'databases can automatically create databeses where DATABASE_URL is of the form: ' +
        chalk.cyan('postgres://USERNAME@localhost/DBNAME'),
    );
    return;
  }
  const [, userName, dbName] = match;

  // if (process.platform !== 'darwin') {
  //   console.log(
  //     'You need to create the postgres database: ' + chalk.cyan(dbConnection),
  //   );
  //   return;
  // }

  let hasBrew = false;
  if (process.env.TRAVIS !== 'true') {
    let listing = '';
    try {
      listing = await runCommand('brew', ['list'], true);
      hasBrew = true;
    } catch (ex) {
      if (process.platform === 'darwin') {
        console.warn(
          'brew was not installed, so databases could not setup postgresql.',
        );
        console.warn('To install brew, run:');
        console.warn(
          '  ' +
            chalk.cyan(
              '/usr/bin/ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"',
            ),
        );
        return;
      }
    }
    if (!/\bpostgresql\b/.test(listing) && hasBrew) {
      console.log('Installing postgresql...');
      await runCommand('brew', ['install', 'postgresql']);
    }
    if (!existsSync('/usr/local/var/postgres')) {
      console.log('Initialising database...');
      try {
        await runCommand('initdb', ['/usr/local/var/postgres', '-E', 'utf8']);
      } catch (ex) {
        if (ex.code !== 'ENOENT') {
          throw ex;
        }
        console.error(
          'Unable to find "initdb" command. Continuing anyway in case a postgres db was already created.',
        );
      }
    }
    if (hasBrew) {
      console.log('Starting postgresql service...');
      await runCommand('brew', ['services', 'start', 'postgresql']);
    }
  }
  try {
    console.log('Creating user...');
    await whenStarted(() => runCommand('createuser', [userName], true));
  } catch (ex) {
    if (
      hasBrew &&
      /createuser\: could not connect to database postgres\: could not connect to server\: No such file or directory/i.test(
        ex.message,
      )
    ) {
      await runCommand('brew', ['services', 'stop', 'postgresql']);
      rimraf('/usr/local/var/postgres/postmaster.pid');
      await runCommand('brew', ['services', 'start', 'postgresql']);
      await whenStarted(() => runCommand('createuser', [userName], true));
    } else if (!/already exists/.test(ex.message)) {
      throw ex;
    }
  }
  try {
    console.log('Creating database...');
    await runCommand('createdb', [dbName], true);
  } catch (ex) {
    if (!/already exists/.test(ex.message)) {
      throw ex;
    }
  }
  if (await isWorking(dbConnection)) {
    console.log('Database created :)');
    return;
  }
  console.warn('Failed to create the database ' + chalk.cyan(dbConnection));
}

module.exports = run;
module.exports.default = run;
