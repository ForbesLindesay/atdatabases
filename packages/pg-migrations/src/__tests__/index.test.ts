import {readFileSync} from 'fs';
import connect, {sql} from '@databases/pg';
import {MigrationsPackage, ConnectedMigrationsPackage} from '../';
import buildPackage from '../build-package';

jest.setTimeout(30000);

// for some reason prettier in jest fails if this isn't required before it is used
// tslint:disable-next-line:no-implicit-dependencies
require('prettier/parser-typescript');

const db = connect();
let output: ConnectedMigrationsPackage = null as any;

afterAll(async () => {
  await db.dispose();
});

test('generate', async () => {
  await buildPackage({
    migrationsDirectory: __dirname + '/migrations',
    outputFile: __dirname + '/output.ts',
    databasesDbPgMigrationsName: '../',
  });
  expect(readFileSync(__dirname + '/output.ts', 'utf8')).toMatchSnapshot();
  const pkg: MigrationsPackage = require('./output').default;
  expect(pkg).toBeInstanceOf(MigrationsPackage);
  output = pkg.withConnection(db);
  expect(output).toBeInstanceOf(ConnectedMigrationsPackage);
});

test('clean database', async () => {
  await db.query(sql`
    DROP TABLE IF EXISTS users;
    DROP TABLE IF EXISTS "atdatabases_migrations";
    DROP TABLE IF EXISTS "atdatabases_migrationsVersion";
  `);
});
test('upAll', async () => {
  await output.upAll({silent: true});
  expect(await db.query(sql`SELECT * FROM users`)).toMatchSnapshot();
});
test('downLast', async () => {
  await output.downLast({silent: true});
  expect(await db.query(sql`SELECT * FROM users`)).toMatchSnapshot();
  await output.downLast({silent: true});
  expect(await db.query(sql`SELECT * FROM users`)).toMatchSnapshot();
  await output.upAll({silent: true});
});
async function getError(fn: () => any) {
  try {
    await fn();
  } catch (ex) {
    return ex;
  }
}
test('downOne', async () => {
  await output.downOne({silent: true});
  expect(await db.query(sql`SELECT * FROM users`)).toMatchSnapshot();
  await output.downOne({silent: true});
  const err = await getError(
    async () => await db.query(sql`SELECT * FROM users`),
  );
  expect(() => {
    if (err) throw err;
  }).toThrowErrorMatchingSnapshot();
  await output.upAll({silent: true});
});
test('downAll', async () => {
  await output.downAll({silent: true});
  const err = await getError(
    async () => await db.query(sql`SELECT * FROM users`),
  );
  expect(() => {
    if (err) throw err;
  }).toThrowErrorMatchingSnapshot();
});

test('upOne', async () => {
  await output.upOne({silent: true});
  expect(await db.query(sql`SELECT * FROM users`)).toMatchSnapshot();
  await output.upOne({silent: true});
  expect(await db.query(sql`SELECT * FROM users`)).toMatchSnapshot();
});
