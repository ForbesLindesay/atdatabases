import {join} from 'path';
import {readdirSync, statSync, readFileSync, writeFileSync} from 'fs';
import chalk from 'chalk';
import getID from '../getID';

function notNull<T>(value: T): value is Exclude<T, null | undefined> {
  return value != null;
}

export interface MigrationInfo {
  index: number;
  fullPath: string;
  name: string;
  id: string;
}

export default function readMigrationsDir(migrationsDirectory: string) {
  const migrations = readdirSync(migrationsDirectory)
    .map((name): MigrationInfo | null => {
      const fullPath = join(migrationsDirectory, name);
      const stat = statSync(fullPath);
      if (!stat.isFile()) {
        return null;
      }
      const match = /^(\d+)\-/.exec(name);
      if (!match) {
        return null;
      }
      const index = parseInt(match[1], 10);
      const src = readFileSync(fullPath, 'utf8');
      const match2 = /^export const id[\s\r\n]*=[\s\r\n]*['"]([0-9a-zA-Z]*)['"](?:\;|$)/m.exec(
        src,
      );
      const id = match2 ? match2[1] : getID();
      if (!match2) {
        writeFileSync(
          fullPath,
          src +
            `\n\n// Do not edit this unique ID\n` +
            `export const id = '${id}';\n`,
        );
      }
      return {index, fullPath, name, id};
    })
    .filter(notNull)
    .sort((a, b) => a.index - b.index);

  migrations.forEach((migration, index) => {
    if (migration.index < 1) {
      throw new Error(
        'Migration IDs should start at 0. Please rename:\n\n' +
          ' ' +
          chalk.cyan(migration.name),
      );
    }
    if (migration.index > index + 1) {
      throw new Error(
        `There does not seem to be a migration with id ${index + 1}. ` +
          `Migrations should exist in a sequence incrementing ` +
          `exactly one number at a time. Please rename:\n\n` +
          ` ${chalk.cyan(migration.name)}`,
      );
    }
    if (migration.index < index + 1 && index > 0) {
      throw new Error(
        `There seem to be two migrations with id ${migration.index}. ` +
          `Each migration should have a unique id otherwise we can't ` +
          `tell which order they should execute in. Please rename one of:\n\n` +
          ` - ${chalk.cyan(migration.name)}\n` +
          ` - ${chalk.cyan(migrations[index - 1].name)}`,
      );
    }
  });

  return migrations;
}
