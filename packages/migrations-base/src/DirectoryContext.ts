import {promises} from 'fs';
import {join} from 'path';

function notNull<T>(value: T): value is Exclude<T, null | undefined> {
  return value != null;
}

export interface IDirectoryContext {
  listFiles(): Promise<string[]>;
  read(filename: string): Promise<string>;
  write(filename: string, content: string): Promise<void>;
  rename(fromFilename: string, toFilename: string): Promise<void>;
  delete(filename: string): Promise<void>;
  resolve(filename: string): string;
}

export default class DirectoryContext implements IDirectoryContext {
  private readonly _directory: string;
  constructor(directory: string) {
    this._directory = directory;
  }
  async listFiles(): Promise<string[]> {
    return (
      await Promise.all(
        (await promises.readdir(this._directory)).map(async (file) => {
          return (await promises.stat(this.resolve(file))).isFile()
            ? file
            : null;
        }),
      )
    ).filter(notNull);
  }
  async read(filename: string): Promise<string> {
    return await promises.readFile(this.resolve(filename), 'utf8');
  }
  async write(filename: string, content: string): Promise<void> {
    await promises.writeFile(this.resolve(filename), content);
  }
  async rename(fromFilename: string, toFilename: string): Promise<void> {
    await promises.rename(this.resolve(fromFilename), this.resolve(toFilename));
  }
  async delete(filename: string): Promise<void> {
    await promises.unlink(this.resolve(filename));
  }
  resolve(filename: string): string {
    return join(this._directory, filename);
  }
}
