import {promises} from 'fs';
import {join} from 'path';
import Result from './types/Result';
import {MigrationWithNoValidExport} from './types/MigrationError';

function notNull<T>(value: T): value is Exclude<T, null | undefined> {
  return value != null;
}

export interface IDirectoryContext<TMigration = unknown> {
  listFiles(): Promise<string[]>;
  read(filename: string): Promise<string>;
  write(filename: string, content: string): Promise<void>;
  rename(fromFilename: string, toFilename: string): Promise<void>;
  delete(filename: string): Promise<void>;
  loadMigration(
    filename: string,
  ): Result<TMigration, MigrationWithNoValidExport>;
}

export default class DirectoryContext<TMigration>
  implements IDirectoryContext<TMigration>
{
  private readonly _directory: string;
  private readonly _loadMigration: (
    filename: string,
  ) => Result<TMigration, MigrationWithNoValidExport>;
  constructor(
    directory: string,
    loadMigration: (
      filename: string,
    ) => Result<TMigration, MigrationWithNoValidExport>,
  ) {
    this._directory = directory;
    this._loadMigration = loadMigration;
  }
  private _resolve(filename: string): string {
    return join(this._directory, filename);
  }
  async listFiles(): Promise<string[]> {
    return (
      await Promise.all(
        (await promises.readdir(this._directory)).map(async (file) => {
          return (await promises.stat(this._resolve(file))).isFile()
            ? file
            : null;
        }),
      )
    ).filter(notNull);
  }
  async read(filename: string): Promise<string> {
    return await promises.readFile(this._resolve(filename), 'utf8');
  }
  async write(filename: string, content: string): Promise<void> {
    await promises.writeFile(this._resolve(filename), content);
  }
  async rename(fromFilename: string, toFilename: string): Promise<void> {
    await promises.rename(
      this._resolve(fromFilename),
      this._resolve(toFilename),
    );
  }
  async delete(filename: string): Promise<void> {
    await promises.unlink(this._resolve(filename));
  }

  loadMigration(
    filename: string,
  ): Result<TMigration, MigrationWithNoValidExport> {
    return this._loadMigration(this._resolve(filename));
  }
}
