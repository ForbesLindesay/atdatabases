import AppliedMigration from './AppliedMigration';
import MigrationFile from './MigrationFile';

type Operation =
  // database operations
  | {kind: 'apply'; value: MigrationFile}
  | {kind: 'applied'; value: AppliedMigration}
  | {kind: 'obsolete'; value: AppliedMigration}
  | {kind: 'ignore_error'; value: AppliedMigration}
  // file system operations
  | {kind: 'delete'; value: MigrationFile}
  | {kind: 'write'; value: MigrationFile}
  | {kind: 'rename'; value: {from: MigrationFile; to: MigrationFile}};

export default Operation;
