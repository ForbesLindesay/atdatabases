import assertNever from 'assert-never';

/**
 * The default level is "READ_COMMITTED". "READ_COMMITTED" and "READ_UNCOMMITTED"
 * are equivalent in postgres.
 *
 * For more information, see: https://www.postgresql.org/docs/9.6/transaction-iso.html
 */
enum TransactionIsolationLevel {
  READ_UNCOMMITTED = 'READ_UNCOMMITTED',
  READ_COMMITTED = 'READ_COMMITTED',
  REPEATABLE_READ = 'REPEATABLE_READ',
  SERIALIZABLE = 'SERIALIZABLE',
}
export default TransactionIsolationLevel;

export function isolationLevelToString(level: TransactionIsolationLevel) {
  switch (level) {
    case TransactionIsolationLevel.READ_UNCOMMITTED:
      return 'ISOLATION LEVEL READ UNCOMMITTED';
    case TransactionIsolationLevel.READ_COMMITTED:
      return 'ISOLATION LEVEL READ COMMITTED';
    case TransactionIsolationLevel.REPEATABLE_READ:
      return 'ISOLATION LEVEL REPEATABLE READ';
    case TransactionIsolationLevel.SERIALIZABLE:
      return 'ISOLATION LEVEL SERIALIZABLE';
    default:
      void assertNever(level, true);
      throw new Error(`${level} is not a valid isolation level`);
  }
}
