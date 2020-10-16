import * as semver from 'semver';
import {IDirectoryContext} from './DirectoryContext';
import DatabaseEngine from './types/DatabaseEngine';
import {
  DatabaseVersionError,
  DatabaseUsesNewerVersionError,
  DatabaseUsesOlderVersionError,
  MigrationFilenamesError,
} from './types/MigrationError';
import Result from './types/Result';
import readMigrationsDir from './methods/readMigrationsDir';
import MigrationsContext, {
  MigrationCommandParameters,
} from './MigrationContext';
import applyOperations from './methods/applyOperations';
import Operation from './types/Operation';

export type Command<TResult, TError> = (
  ctx: MigrationsContext,
) => Result<TResult, TError>;

export default async function runCommand<TMigration, TResult, TError>(
  engine: DatabaseEngine<TMigration>,
  directory: IDirectoryContext,
  command: (ctx: MigrationsContext) => Result<TResult, TError>,
  parameters: MigrationCommandParameters,
  {
    dryRun = false,
    handleError = async (e) => Result.fail(e),
    beforeOperation = async () => undefined,
    afterOperation = async () => undefined,
  }: {
    dryRun?: boolean;
    handleError?: (
      error: TError,
      ctx: MigrationsContext,
    ) => Promise<Result<void, TError>>;
    beforeOperation?: (
      operation: Operation,
    ) => Promise<void | 'stop' | 'rollback'>;
    afterOperation?: (operation: Operation) => Promise<void>;
  } = {},
): Promise<
  Result<
    void,
    | TError
    | DatabaseVersionError
    | DatabaseUsesNewerVersionError
    | DatabaseUsesOlderVersionError
    | MigrationFilenamesError
  >
> {
  const databaseVersionResult = await engine.checkDatabaseVersion();
  if (!databaseVersionResult.ok) return databaseVersionResult;

  const schemaVersionResult = await engine.tx(async (tx) => {
    const currentSchemaVersion = await tx.getVersion();

    if (semver.gt(currentSchemaVersion, engine.packageVersion)) {
      return Result.fail<DatabaseUsesNewerVersionError>({
        code: 'database_uses_newer_version',
        databaseVersion: currentSchemaVersion,
        packageVersion: engine.packageVersion,
      });
    }

    if (semver.lt(currentSchemaVersion, engine.packageVersion)) {
      if (dryRun) {
        return Result.fail<DatabaseUsesOlderVersionError>({
          code: 'database_uses_older_version',
          databaseVersion: currentSchemaVersion,
          packageVersion: engine.packageVersion,
        });
      }
      // "updateVersion" should run any necessary migrations
      await tx.updateVersion(currentSchemaVersion, engine.packageVersion, (v) =>
        semver.lt(currentSchemaVersion, v),
      );
    }
    return Result.ok();
  });

  if (!schemaVersionResult.ok) return schemaVersionResult;

  const migrationFilesResult = await readMigrationsDir(directory);
  if (!migrationFilesResult.ok) return migrationFilesResult;

  const appliedMigrations = await engine.tx(
    async (tx) => await tx.getMigrations(),
  );
  const ctx = new MigrationsContext(
    appliedMigrations,
    migrationFilesResult.value,
    parameters,
  );
  let commandResult = command(ctx);
  while (!commandResult.ok) {
    const handled = await handleError(commandResult.reason, ctx);
    if (!handled.ok) return handled;
    commandResult = command(ctx);
  }
  if (dryRun) {
    for (const operation of ctx.operations) {
      if (await beforeOperation(operation)) {
        return Result.ok();
      }
      await afterOperation(operation);
    }
  } else {
    await applyOperations(ctx, engine, directory, {
      beforeOperation,
      afterOperation,
    });
  }
  return Result.ok();
}
