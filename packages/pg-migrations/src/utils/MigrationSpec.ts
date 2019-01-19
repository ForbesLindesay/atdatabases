import MigrationMetadata from './MigrationMetadata';
import Operation from './Operation';

export default interface MigrationSpec extends MigrationMetadata {
  readonly operation: () => Promise<Operation>;
}
