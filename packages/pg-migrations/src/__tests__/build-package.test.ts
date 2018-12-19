import {readFileSync} from 'fs';
import buildPackage from '../build-package';

// for some reason prettier in jest fails if this isn't required before it is used
require('prettier/parser-typescript');

test('generate', async () => {
  await buildPackage({
    migrationsDirectory: __dirname + '/migrations',
    outputFile: __dirname + '/output.ts',
    databasesDbPgMigrationsName: '../',
  });
  expect(readFileSync(__dirname + '/output.ts', 'utf8')).toMatchSnapshot();
});
