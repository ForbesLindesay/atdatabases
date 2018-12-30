import {readFileSync} from 'fs';
import connect from '@databases/pg';
import sql from '@databases/sql';
import {MigrationsPackage} from '../';
import buildPackage from '../build-package';

jest.setTimeout(30000);

// for some reason prettier in jest fails if this isn't required before it is used
require('prettier/parser-typescript');

let output: MigrationsPackage = null as any;

test('generate', async () => {
  await buildPackage({
    migrationsDirectory: __dirname + '/migrations',
    outputFile: __dirname + '/output.ts',
    databasesDbPgMigrationsName: '../',
  });
  expect(readFileSync(__dirname + '/output.ts', 'utf8')).toMatchSnapshot();
  output = require('./output').default;
  expect(output).toBeInstanceOf(MigrationsPackage);
});

const db = connect();

test('clean database', async () => {
  await db.query(sql`
    DROP TABLE IF EXISTS users;
    DROP TABLE IF EXISTS "atdatabases_migrations";
    DROP TABLE IF EXISTS "atdatabases_migrationsVersion";
  `);
});
test('upAll', async () => {
  await output.upAll(undefined, {silent: true});
  expect(await db.query(sql`SELECT * FROM users`)).toMatchSnapshot();
});
test('downLast', async () => {
  await output.downLast(undefined, {silent: true});
  expect(await db.query(sql`SELECT * FROM users`)).toMatchSnapshot();
  await output.downLast(undefined, {silent: true});
  expect(await db.query(sql`SELECT * FROM users`)).toMatchSnapshot();
  await output.upAll(undefined, {silent: true});
});
async function getError(fn: () => any) {
  try {
    await fn();
  } catch (ex) {
    return ex;
  }
}
test('downOne', async () => {
  await output.downOne(undefined, {silent: true});
  expect(await db.query(sql`SELECT * FROM users`)).toMatchSnapshot();
  await output.downOne(undefined, {silent: true});
  const err = await getError(
    async () => await db.query(sql`SELECT * FROM users`),
  );
  expect(() => {
    if (err) throw err;
  }).toThrowErrorMatchingSnapshot();
  await output.upAll(undefined, {silent: true});
});
test('downAll', async () => {
  await output.downAll(undefined, {silent: true});
  const err = await getError(
    async () => await db.query(sql`SELECT * FROM users`),
  );
  expect(() => {
    if (err) throw err;
  }).toThrowErrorMatchingSnapshot();
});

test('upOne', async () => {
  await output.upOne(undefined, {silent: true});
  expect(await db.query(sql`SELECT * FROM users`)).toMatchSnapshot();
  await output.upOne(undefined, {silent: true});
  expect(await db.query(sql`SELECT * FROM users`)).toMatchSnapshot();
});
