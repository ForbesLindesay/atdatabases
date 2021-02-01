import {spawnSync, SpawnSyncOptions} from 'child_process';
import connect, {sql} from '@databases/pg';

// We are using sucrase to compile TypeScript on the fly, and each of these tests
// is starting a fresh node process and creating, then destroying a fresh database
// connection, which makes them feel slow overall, even though each individual test
// isn't actually that slow.
jest.setTimeout(15_000);
const db = connect({bigIntMode: 'bigint'});

const env = {...process.env, FORCE_COLOR: 'false'};

function output(proc: ReturnType<typeof spawnSync>) {
  return [
    `stdout:`,
    proc.stdout?.toString('utf8').replace(/^/gm, '  '),
    `stderr:`,
    proc.stderr?.toString('utf8').replace(/^/gm, '  '),
  ].join('\n');
}
function run(params: string[], options: Partial<SpawnSyncOptions> = {}) {
  // const proc = spawnSync(
  //   'node',
  //   ['--require', 'sucrase/register', 'cli', ...params],
  //   {cwd: `${__dirname}/..`, env, timeout: 2000, ...options},
  // );
  const proc = spawnSync('node', ['../lib/cli', ...params], {
    cwd: `${__dirname}/..`,
    env,
    timeout: 5_000,
    ...options,
  });
  if (proc.error) throw proc.error;
  return proc;
}

afterAll(async () => {
  await db.dispose();
});

test('clean database', async () => {
  await db.query(sql`
    DROP TABLE IF EXISTS users;
    DROP TABLE IF EXISTS atdatabases_migrations_applied;
    DROP TABLE IF EXISTS atdatabases_migrations_version;
  `);
});

test('help', async () => {
  const proc = run(['help']);
  expect(output(proc)).toMatchSnapshot();
  expect(proc.status).toBe(0);
});

test('help apply', async () => {
  const proc = run(['help', 'apply']);
  expect(output(proc)).toMatchSnapshot();
  expect(proc.status).toBe(0);
});

test('apply - missing directory', async () => {
  const proc = run(['apply'], {
    env: {...env, CI: 'true'},
  });
  expect(output(proc)).toMatchSnapshot();
  expect(proc.status).toBe(1);
});

test('apply --dry-run', async () => {
  const proc = run(['apply', '--dry-run', `-D`, `${__dirname}/migrations`], {
    env: {...env, CI: 'true'},
  });
  expect(output(proc)).toMatchSnapshot();
  expect(proc.status).toBe(0);
});

test('apply', async () => {
  const proc = run(['apply', `-D`, `${__dirname}/migrations`], {
    env: {...env, CI: 'true'},
  });
  expect(output(proc)).toMatchSnapshot();
  expect(proc.status).toBe(0);
});

test('apply - after already appying', async () => {
  const proc = run(['apply', `-D`, `${__dirname}/migrations`], {
    env: {...env, CI: 'true'},
  });
  expect(output(proc)).toMatchSnapshot();
  expect(proc.status).toBe(0);
});

test('apply --dry-run - after already appying', async () => {
  const proc = run(['apply', '--dry-run', `-D`, `${__dirname}/migrations`], {
    env: {...env, CI: 'true'},
  });
  if (proc.error) throw proc.error;
  expect(output(proc)).toMatchSnapshot();
  expect(proc.status).toBe(0);
});

test('migrations applied', async () => {
  expect(await db.query(sql`SELECT * FROM users`)).toEqual([
    {
      id: BigInt(1),
      name: 'Forbes Lindesay',
    },
    {
      id: BigInt(2),
      name: 'Eleanor Brodie',
    },
    {
      id: BigInt(3),
      name: 'Carl Tedder',
    },
  ]);
});
