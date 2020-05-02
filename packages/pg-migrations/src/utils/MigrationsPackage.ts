import connect, {Connection} from '@databases/pg';
import MigrationSpec from './MigrationSpec';
import ConnectedMigrationsPackage from './ConnectedMigrationsPackage';
import MigrationMetadata from './MigrationMetadata';

type Args<T extends (...args: Array<any>) => any> = T extends (
  ...args: infer TArgs
) => any
  ? TArgs
  : never;

export default class MigrationsPackage {
  private readonly _migrations: ReadonlyArray<MigrationSpec>;
  public readonly migrations: ReadonlyArray<MigrationMetadata>;
  constructor(migrations: MigrationSpec[]) {
    this._migrations = migrations;
    this.migrations = migrations.map((m) => ({
      id: m.id,
      index: m.index,
      name: m.name,
    }));
  }
  connect(...args: Args<typeof connect>) {
    const connection = connect(...args);
    return new ConnectedMigrationsPackage(connection, this._migrations);
  }
  withConnection(connection: Connection) {
    return new ConnectedMigrationsPackage(connection, this._migrations);
  }
}
