/**
 * For more information, see https://dev.mysql.com/doc/refman/8.0/en/commit.html
 */
export default interface TransactionOptions {
  /**
   * The default value is `false`
   */
  readOnly?: boolean;
  /**
   * The WITH CONSISTENT SNAPSHOT modifier starts a consistent read for storage engines
   * that are capable of it. This applies only to InnoDB. The effect is the same as
   * issuing a START TRANSACTION followed by a SELECT from any InnoDB table. See
   * Section 15.7.2.3, “Consistent Nonlocking Reads”. The WITH CONSISTENT SNAPSHOT
   * modifier does not change the current transaction isolation level, so it provides
   * a consistent snapshot only if the current isolation level is one that permits a
   * consistent read. The only isolation level that permits a consistent read is
   * REPEATABLE READ. For all other isolation levels, the WITH CONSISTENT SNAPSHOT
   * clause is ignored. A warning is generated when the WITH CONSISTENT SNAPSHOT
   * clause is ignored.
   */
  withConsistentSnapshot?: boolean;

  // retrySerializationFailures?: boolean | number;
}
