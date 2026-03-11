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
