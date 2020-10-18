import {spawnSync} from 'child_process';
import connect, {sql} from '@databases/pg';

// We are using sucrase to compile TypeScript on the fly, and each of these tests
// is starting a fresh node process and creating, then destroying a fresh database
// connection, which makes them feel slow overall, even though each individual test
// isn't actually that slow.
jest.setTimeout(30000);
const db = connect();

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
  const {status, stderr, stdout} = spawnSync(
    'node',
    ['--require', 'sucrase/register', 'cli', 'help'],
    {cwd: `${__dirname}/..`},
  );
  expect(stdout?.toString('utf8')).toMatchSnapshot('stdout');
  expect(stderr?.toString('utf8')).toMatchSnapshot('stderr');
  expect(status).toBe(0);
});

test('help apply', async () => {
  const {status, stderr, stdout} = spawnSync(
    'node',
    ['--require', 'sucrase/register', 'cli', 'help', 'apply'],
    {cwd: `${__dirname}/..`},
  );
  expect(stdout?.toString('utf8')).toMatchSnapshot('stdout');
  expect(stderr?.toString('utf8')).toMatchSnapshot('stderr');
  expect(status).toBe(0);
});

test('apply - missing directory', async () => {
  const {status, stderr, stdout} = spawnSync(
    'node',
    ['--require', 'sucrase/register', 'cli', 'apply'],
    {cwd: `${__dirname}/..`, env: {...process.env, CI: 'true'}},
  );
  expect(stdout?.toString('utf8')).toMatchSnapshot('stdout');
  expect(stderr?.toString('utf8')).toMatchSnapshot('stderr');
  expect(status).toBe(1);
});

test('apply --dry-run', async () => {
  const {status, stderr, stdout} = spawnSync(
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
    {cwd: `${__dirname}/..`, env: {...process.env, CI: 'true'}},
  );
  expect(stdout?.toString('utf8')).toMatchSnapshot('stdout');
  expect(stderr?.toString('utf8')).toMatchSnapshot('stderr');
  expect(status).toBe(0);
});

test('apply', async () => {
  const {status, stderr, stdout} = spawnSync(
    'node',
    [
      '--require',
      'sucrase/register',
      'cli',
      'apply',
      `-D`,
      `${__dirname}/migrations`,
    ],
    {cwd: `${__dirname}/..`, env: {...process.env, CI: 'true'}},
  );
  expect(stdout?.toString('utf8')).toMatchSnapshot('stdout');
  expect(stderr?.toString('utf8')).toMatchSnapshot('stderr');
  expect(status).toBe(0);
});

test('apply - after already appying', async () => {
  const {status, stderr, stdout} = spawnSync(
    'node',
    [
      '--require',
      'sucrase/register',
      'cli',
      'apply',
      `-D`,
      `${__dirname}/migrations`,
    ],
    {cwd: `${__dirname}/..`, env: {...process.env, CI: 'true'}},
  );
  expect(stdout?.toString('utf8')).toMatchSnapshot('stdout');
  expect(stderr?.toString('utf8')).toMatchSnapshot('stderr');
  expect(status).toBe(0);
});

test('apply --dry-run - after already appying', async () => {
  const {status, stderr, stdout} = spawnSync(
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
    {cwd: `${__dirname}/..`, env: {...process.env, CI: 'true'}},
  );
  expect(stdout?.toString('utf8')).toMatchSnapshot('stdout');
  expect(stderr?.toString('utf8')).toMatchSnapshot('stderr');
  expect(status).toBe(0);
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
