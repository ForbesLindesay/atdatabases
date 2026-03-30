import {statSync} from 'fs';
import {resolve} from 'path';
import chalk from 'chalk';

export default function assertIsDirectory(
  path: string,
  mode: 'exit' | 'throw',
): string {
  try {
    if (statSync(path).isDirectory()) return resolve(path);
  } catch (ex) {
    // treat errors the same as non-directories
  }

  switch (mode) {
    case 'exit':
      console.error(
        `${chalk.cyan(
          path,
        )} is not a valid directory. The directory can either be passed via the "--directory" CLI parameter or specified via the "migrationsDirectory" config value.`,
      );
      return process.exit(1);
    case 'throw':
      throw new Error(`${path} is not a valid directory`);
  }
}
