import Operation from './utils/Operation';
import MigrationSpec from './utils/MigrationSpec';
import MigrationStatus from './utils/MigrationStatus';
import ConnectedMigrationsPackage, {
  OperationOptions,
  Direction,
  NumberOfOperations,
} from './utils/ConnectedMigrationsPackage';
import MigrationMetadata from './utils/MigrationMetadata';
import MigrationsPackage from './utils/MigrationsPackage';
import {Connection, sql} from '@databases/pg';

export {
  MigrationSpec,
  Operation,
  MigrationsPackage,
  ConnectedMigrationsPackage,
  OperationOptions,
  Direction,
  NumberOfOperations,
  MigrationStatus,
  MigrationMetadata,
  Connection,
  sql,
};

export function packageOperation(op: Operation): Operation {
  return op;
}

export default function packageMigrations(
  ...migrations: MigrationSpec[]
): MigrationsPackage {
  const pkg = new MigrationsPackage(migrations);
  const AUTO_RUN_DB_MIGRATION_PROCESS: any = (global as any)
    .AUTO_RUN_DB_MIGRATION_PROCESS;
  if (AUTO_RUN_DB_MIGRATION_PROCESS) {
    AUTO_RUN_DB_MIGRATION_PROCESS(pkg);
  }
  return pkg;
}
