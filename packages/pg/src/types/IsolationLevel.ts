import assertNever from 'assert-never';

/**
 * The default level is "READ_COMMITTED". "READ_COMMITTED" and "READ_UNCOMMITTED"
 * are equivalent in postgres.
 *
 * For more information, see: https://www.postgresql.org/docs/9.6/transaction-iso.html
 */
enum IsolationLevel {
  READ_UNCOMMITTED = 'READ_UNCOMMITTED',
  READ_COMMITTED = 'READ_COMMITTED',
  REPEATABLE_READ = 'REPEATABLE_READ',
  SERIALIZABLE = 'SERIALIZABLE',
}
export default IsolationLevel;

export function isolationLevelToString(level: IsolationLevel) {
  switch (level) {
    case IsolationLevel.READ_UNCOMMITTED:
      return 'ISOLATION LEVEL READ UNCOMMITTED';
    case IsolationLevel.READ_COMMITTED:
      return 'ISOLATION LEVEL READ COMMITTED';
    case IsolationLevel.REPEATABLE_READ:
      return 'ISOLATION LEVEL REPEATABLE READ';
    case IsolationLevel.SERIALIZABLE:
      return 'ISOLATION LEVEL SERIALIZABLE';
    default:
      void assertNever(level, true);
      throw new Error(`${level} is not a valid isolation level`);
  }
}
