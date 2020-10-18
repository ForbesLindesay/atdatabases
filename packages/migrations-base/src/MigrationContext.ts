import AppliedMigration from './types/AppliedMigration';
import MigrationFile from './types/MigrationFile';
import Operation from './types/Operation';
import {SequenceErrorIgnoreCode} from './methods/validateMigrationsSequence';

export function sortMigrations<
  T extends {readonly index: number; readonly applied_at?: Date}
>(migrations: readonly T[]): T[] {
  return migrations
    .slice()
    .sort(
      (a, b) =>
        a.index - b.index ||
        (a.applied_at && b.applied_at
          ? a.applied_at.getTime() - b.applied_at.getTime()
          : 0),
    );
}

function insertMigration<T extends {readonly index: number}, S extends T>(
  migrations: T[],
  newMigration: S,
): void {
  const indexOfMigrationAfterTheNewOne = migrations.findIndex(
    (m) => m.index > newMigration.index,
  );
  if (indexOfMigrationAfterTheNewOne === -1) {
    migrations.push(newMigration);
  } else {
    migrations.splice(indexOfMigrationAfterTheNewOne, 0, newMigration);
  }
}

export interface MigrationCommandParameters {
  applied_migration?: number;
  migration_file?: number;
  error_type?: SequenceErrorIgnoreCode;
  ignored_errors?: SequenceErrorIgnoreCode[];
}
export default class MigrationsContext {
  public readonly originalAppliedMigrations: readonly AppliedMigration[];
  private readonly _appliedMigrations: AppliedMigration[];
  private readonly _migrationFiles: MigrationFile[];

  private readonly _operations: Operation[] = [];

  public readonly parameters: MigrationCommandParameters = {};
  constructor(
    appliedMigrations: readonly AppliedMigration[],
    migrationFiles: readonly MigrationFile[],
    parameters: MigrationCommandParameters,
  ) {
    this.originalAppliedMigrations = sortMigrations(appliedMigrations);
    this._appliedMigrations = sortMigrations(appliedMigrations);
    this._migrationFiles = sortMigrations(migrationFiles);
    this.parameters = parameters;
  }

  get appliedMigrations(): readonly AppliedMigration[] {
    return this._appliedMigrations.filter((m) => !m.obsolete);
  }
  get migrationFiles(): readonly MigrationFile[] {
    return this._migrationFiles;
  }
  get operations(): readonly Operation[] {
    return this._operations;
  }

  migrationIdToString(id: number) {
    const length = this.migrationFiles.length
      ? Math.max(...this.migrationFiles.map((f) => f.name.split('-').length))
      : 3;
    return `${id}`.padStart(length, '0');
  }
  fixMigrationName(migration: MigrationFile): MigrationFile {
    const name = migration.name.split('-').slice(1).join('-');
    return {
      ...migration,
      name: `${this.migrationIdToString(migration.index)}-${name}`,
    };
  }

  hasAppliedMigration(migration: MigrationFile) {
    return this.appliedMigrations.some((m) => m.index === migration.index);
  }

  getAppliedMigration(migration: MigrationFile) {
    return this.appliedMigrations.find((m) => m.index === migration.index);
  }

  getMigrationFile(index: number) {
    return this.migrationFiles.find((m) => m.index === index);
  }

  markMigrationAsApplied(migration: MigrationFile) {
    if (this.hasAppliedMigration(migration)) {
      throw new Error(`Migration "${migration.name}" is already applied`);
    }
    const applied: AppliedMigration = {
      index: migration.index,
      name: migration.name,
      script: migration.script,
      applied_at: new Date(),
      ignored_error: null,
      obsolete: false,
    };
    insertMigration(this._appliedMigrations, applied);
    this._operations.push({kind: 'applied', value: applied});
  }

  markAppliedMigrationAsObsolete(migration: AppliedMigration) {
    const index = this._appliedMigrations.findIndex(
      (m) => m.index === migration.index && !m.obsolete,
    );
    if (index === -1) {
      throw new Error(`AppliedMigration "${migration.name}" does not exist`);
    }

    const applied: AppliedMigration = {
      ...this._appliedMigrations[index],
      obsolete: true,
    };
    this._appliedMigrations[index] = applied;
    this._operations.push({kind: 'obsolete', value: applied});
  }

  ignoreErrorPermanently(migration: AppliedMigration, error: string) {
    const applied = this.ignoreErrorTemporarily(migration, error);
    this._operations.push({kind: 'ignore_error', value: applied});
  }

  ignoreErrorTemporarily(migration: AppliedMigration, error: string) {
    const index = this._appliedMigrations.findIndex(
      (m) => m.index === migration.index && !m.obsolete,
    );
    if (index === -1) {
      throw new Error(`AppliedMigration "${migration.name}" does not exist`);
    }

    const applied: AppliedMigration = {
      ...this._appliedMigrations[index],
      ignored_error: error,
    };
    this._appliedMigrations[index] = applied;
    this._operations.push({kind: 'obsolete', value: applied});
    return applied;
  }

  writeMigrationFile(migration: MigrationFile) {
    if (this.getMigrationFile(migration.index)) {
      throw new Error(`MigrationFile ${migration.index} already exists`);
    }

    insertMigration(this._migrationFiles, migration);
    this._operations.push({kind: 'write', value: migration});
  }

  changeMigrationFileIndex(migration: MigrationFile, newIndex: number) {
    const fileToChange = this.getMigrationFile(migration.index);
    if (!fileToChange || fileToChange.name !== migration.name) {
      throw new Error(`MigrationFile ${migration.name} does not exist`);
    }
    const fileThatWouldBeReplaced = this.getMigrationFile(newIndex);
    if (fileThatWouldBeReplaced) {
      throw new Error(
        `There is already a MigrationFile with index ${newIndex} called ${fileThatWouldBeReplaced.name}.`,
      );
    }

    this._migrationFiles.splice(
      this._migrationFiles.findIndex((m) => m.index === migration.index),
      1,
    );

    const newMigration = this.fixMigrationName({
      ...migration,
      index: newIndex,
    });
    insertMigration(this._migrationFiles, newMigration);
    this._operations.push({
      kind: 'rename',
      value: {
        from: migration,
        to: newMigration,
      },
    });
  }

  deleteMigrationFile(migration: MigrationFile) {
    if (!this.getMigrationFile(migration.index)) {
      throw new Error(`MigrationFile ${migration.name} does not exist`);
    }
    this._migrationFiles.splice(
      this._migrationFiles.findIndex((m) => m.index === migration.index),
      1,
    );
    this._operations.push({kind: 'delete', value: migration});
  }

  applyMigration(migration: MigrationFile) {
    if (this.hasAppliedMigration(migration)) {
      throw new Error(`${migration.name} is already applied`);
    }
    this._operations.push({kind: 'apply', value: migration});
  }

  // async resolveMigrationFilename(
  //   migration: MigrationFile,
  //   directory: IDirectoryContext,
  // ) {
  //   const operations = this.operations.slice().reverse();
  //   let filename = migration.name;
  //   for (const op of operations) {
  //     switch (op.kind) {
  //       case 'rename':
  //         if (op.value.to.name === filename) {
  //           filename = op.value.from.name;
  //         }
  //         break;
  //       case 'write':
  //         if (op.value.name === filename) {
  //           const index = this._operations.findIndex((o) => o === op);
  //           if (index === -1) {
  //             throw new Error('Unable to find operation');
  //           }
  //           let tempFilename = `_temp-${filename}`;
  //           let tempFileNumber = 0;
  //           while (this._temporaryFiles.includes(tempFilename)) {
  //             tempFileNumber++;
  //             tempFilename = `_temp${tempFileNumber}-${filename}`;
  //           }
  //           this._temporaryFiles.push(tempFilename);
  //           await directory.write(tempFilename, op.value.script);
  //           this._operations[index] = {
  //             kind: 'rename',
  //             value: {from: {...op.value, name: tempFilename}, to: op.value},
  //           };
  //           filename = '';
  //         }
  //         break;
  //     }
  //     break;
  //   }
  //   return directory.resolve(filename);
  // }
}
