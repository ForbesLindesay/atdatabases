// @public

import {relative, resolve, dirname} from 'path';
import {readFileSync, writeFileSync} from 'fs';
import readMigrationsDir from './utils/readMigrationsDir';

let prettier: any = null;
try {
  // tslint:disable-next-line:no-implicit-dependencies
  prettier = require('prettier');
  if (
    typeof prettier.resolveConfig !== 'function' ||
    typeof prettier.format !== 'function'
  ) {
    prettier = null;
  }
} catch (ex) {
  prettier = null;
}

export interface Options {
  migrationsDirectory: string;
  outputFile: string;
  databasesDbPgMigrationsName?: string;
}

export default async function buildPackage(options: Options) {
  const migrationsDirectory = resolve(options.migrationsDirectory);
  const outputFile = resolve(options.outputFile);

  const prettierOptions =
    (prettier && (await prettier.resolveConfig(outputFile))) || {};
  if (prettierOptions) prettierOptions.parser = 'typescript';
  const writeFile = (filename: string, src: string) => {
    const formatted = prettier ? prettier.format(src, prettierOptions) : src;
    try {
      if (readFileSync(filename, 'utf8') === formatted) {
        return;
      }
    } catch (ex) {
      if (ex.code !== 'ENOENT') {
        throw ex;
      }
    }
    writeFileSync(filename, formatted);
  };

  const migrations = readMigrationsDir(migrationsDirectory);
  const output = `
    // auto generated by @databases/pg-migrations - do not edit by hand

    import packageMigrations, {MigrationsPackage${
      migrations.length ? ', packageOperation' : ''
    }} from '${
    options.databasesDbPgMigrationsName || '@databases/pg-migrations'
  }';

    export {MigrationsPackage};
    export default packageMigrations(
      ${migrations
        .map(
          (migration) =>
            `{
              id: ${JSON.stringify(migration.id)},
              index: ${migration.index},
              name: ${JSON.stringify(migration.name)},
              operation: async () => packageOperation(await import(${JSON.stringify(
                relative(dirname(outputFile), migration.fullPath)
                  .replace(/\\/g, '/')
                  .replace(/^([^\.])/, './$1')
                  .replace(/\.[^\.]+$/, ''),
              )})),
            },`,
        )
        .join('\n')}
    );
  `;
  writeFile(outputFile, output);
}
