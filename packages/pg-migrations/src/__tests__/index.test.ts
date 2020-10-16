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
// test('apply migrations (dry run)', async () => {
//   spawnSync('node', ['--require', 'sucrase/register', 'cli'], {
//     cwd: `${__dirname}/..`,
//     stdio: 'inherit',
//   });

//   const onApplying = jest.fn();
//   const onApplied = jest.fn();
//   const count = await applyMigrations(
//     db,
//     `${__dirname}/migrations`,
//     {
//       onApplying,
//       onApplied,
//       onAppliedMigrationAfterUnappliedMigrations: expectNotCalled(
//         'onAppliedMigrationAfterUnappliedMigrations',
//       ),
//       onMigrationDeleted: expectNotCalled('onMigrationDeleted'),
//       onMigrationEdited: expectNotCalled('onMigrationEdited'),
//     },
//     {dryRun: true},
//   );
//   expect(onApplying).toBeCalledTimes(3);
//   expect(onApplied).toBeCalledTimes(3);
//   expect(count).toBe(3);

//   await expect(db.query(sql`SELECT * FROM users`)).rejects.toHaveProperty(
//     'message',
//     expect.stringContaining('relation "users" does not exist'),
//   );
// });

// // test('upAll', async () => {
// //   await output.upAll({silent: true});
// //   expect(await db.query(sql`SELECT * FROM users`)).toMatchSnapshot();
// // });
// // test('downLast', async () => {
// //   await output.downLast({silent: true});
// //   expect(await db.query(sql`SELECT * FROM users`)).toMatchSnapshot();
// //   await output.downLast({silent: true});
// //   expect(await db.query(sql`SELECT * FROM users`)).toMatchSnapshot();
// //   await output.upAll({silent: true});
// // });
// // async function getError(fn: () => any) {
// //   try {
// //     await fn();
// //   } catch (ex) {
// //     return ex;
// //   }
// // }
// // test('downOne', async () => {
// //   await output.downOne({silent: true});
// //   expect(await db.query(sql`SELECT * FROM users`)).toMatchSnapshot();
// //   await output.downOne({silent: true});
// //   const err = await getError(
// //     async () => await db.query(sql`SELECT * FROM users`),
// //   );
// //   expect(() => {
// //     if (err) throw err;
// //   }).toThrowErrorMatchingSnapshot();
// //   await output.upAll({silent: true});
// // });
// // test('downAll', async () => {
// //   await output.downAll({silent: true});
// //   const err = await getError(
// //     async () => await db.query(sql`SELECT * FROM users`),
// //   );
// //   expect(() => {
// //     if (err) throw err;
// //   }).toThrowErrorMatchingSnapshot();
// // });

// // test('upOne', async () => {
// //   await output.upOne({silent: true});
// //   expect(await db.query(sql`SELECT * FROM users`)).toMatchSnapshot();
// //   await output.upOne({silent: true});
// //   expect(await db.query(sql`SELECT * FROM users`)).toMatchSnapshot();
// // });
