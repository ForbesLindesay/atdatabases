import {spawnSync} from 'child_process';
import connect, {sql} from '@databases/pg';

// We are using sucrase to compile TypeScript on the fly, and each of these tests
// is starting a fresh node process and creating, then destroying a fresh database
// connection, which makes them feel slow overall, even though each individual test
// isn't actually that slow.
jest.setTimeout(30000);
const db = connect();

const env = {...process.env, FORCE_COLOR: 'false'};

function output(proc: ReturnType<typeof spawnSync>) {
  return [
    `stdout:`,
    proc.stdout?.toString('utf8').replace(/^/gm, '  '),
    `stderr:`,
    proc.stderr?.toString('utf8').replace(/^/gm, '  '),
  ].join('\n');
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
  const proc = spawnSync(
    'node',
    ['--require', 'sucrase/register', 'cli', 'help'],
    {cwd: `${__dirname}/..`, env},
  );
  expect(output(proc)).toMatchSnapshot();
  expect(proc.status).toBe(0);
});

test('help apply', async () => {
  const proc = spawnSync(
    'node',
    ['--require', 'sucrase/register', 'cli', 'help', 'apply'],
    {cwd: `${__dirname}/..`, env},
  );
  expect(output(proc)).toMatchSnapshot();
  expect(proc.status).toBe(0);
});

test('apply - missing directory', async () => {
  const proc = spawnSync(
    'node',
    ['--require', 'sucrase/register', 'cli', 'apply'],
    {cwd: `${__dirname}/..`, env: {...env, CI: 'true'}},
  );
  expect(output(proc)).toMatchSnapshot();
  expect(proc.status).toBe(1);
});

test('apply --dry-run', async () => {
  const proc = spawnSync(
    'node',
    [
      '--require',
      'sucrase/register',
      'cli',
      'apply',
      '--dry-run',
      `-D`,
      `${__dirname}/migrations`,
    ],
    {cwd: `${__dirname}/..`, env: {...env, CI: 'true'}},
  );
  expect(output(proc)).toMatchSnapshot();
  expect(proc.status).toBe(0);
});

test('apply', async () => {
  const proc = spawnSync(
    'node',
    [
      '--require',
      'sucrase/register',
      'cli',
      'apply',
      `-D`,
      `${__dirname}/migrations`,
    ],
    {cwd: `${__dirname}/..`, env: {...env, CI: 'true'}},
  );
  expect(output(proc)).toMatchSnapshot();
  expect(proc.status).toBe(0);
});

test('apply - after already appying', async () => {
  const proc = spawnSync(
    'node',
    [
      '--require',
      'sucrase/register',
      'cli',
      'apply',
      `-D`,
      `${__dirname}/migrations`,
    ],
    {cwd: `${__dirname}/..`, env: {...env, CI: 'true'}},
  );
  expect(output(proc)).toMatchSnapshot();
  expect(proc.status).toBe(0);
});

test('apply --dry-run - after already appying', async () => {
  const proc = spawnSync(
    'node',
    [
      '--require',
      'sucrase/register',
      'cli',
      'apply',
      '--dry-run',
      `-D`,
      `${__dirname}/migrations`,
    ],
    {cwd: `${__dirname}/..`, env: {...env, CI: 'true'}},
  );
  expect(output(proc)).toMatchSnapshot();
  expect(proc.status).toBe(0);
});

test('migrations applied', async () => {
  expect(await db.query(sql`SELECT * FROM users`)).toEqual([
    {
      id: 1,
      name: 'Forbes Lindesay',
    },
    {
      id: 2,
      name: 'Eleanor Brodie',
    },
    {
      id: 3,
      name: 'Carl Tedder',
    },
  ]);
});
