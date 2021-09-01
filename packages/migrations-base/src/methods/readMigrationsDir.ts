import MigrationFile from '../types/MigrationFile';
import Result from '../types/Result';
import {MigrationFilenamesError} from '../types/MigrationError';
import {IDirectoryContext} from '../DirectoryContext';

function notNull<T>(value: T): value is Exclude<T, null | undefined> {
  return value != null;
}

const IGNORED_EXTENSIONS = ['.d.ts'];
const INCLUDED_EXTENSIONS = ['.sql', '.js', '.mjs', '.jsx', '.ts', '.tsx'];

export default async function readMigrationsDir(
  migrationsDirectory: IDirectoryContext,
): Promise<Result<MigrationFile[], MigrationFilenamesError>> {
  const invalidFilenames: string[] = [];

  const migrations = (
    await Promise.all(
      (
        await migrationsDirectory.listFiles()
      ).map(async (fileName): Promise<MigrationFile | null> => {
        if (fileName[0] === '_') return null;

        if (
          IGNORED_EXTENSIONS.some((e) => fileName.endsWith(e)) ||
          !INCLUDED_EXTENSIONS.some((e) => fileName.endsWith(e))
        ) {
          return null;
        }
        const match = /^(\d+)\-/.exec(fileName);
        if (!match) {
          invalidFilenames.push(fileName);
          return null;
        }
        const index = parseInt(match[1], 10);
        const src = await migrationsDirectory.read(fileName);

        return {
          index,
          name: fileName,
          script: src,
        };
      }),
    )
  ).filter(notNull);

  if (invalidFilenames.length) {
    return Result.fail<MigrationFilenamesError>({
      code: 'migration_filenames',
      files: invalidFilenames,
    });
  }

  return Result.ok(migrations);
}
