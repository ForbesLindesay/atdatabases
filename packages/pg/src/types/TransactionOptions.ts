import IsolationLevel from './IsolationLevel';

/**
 * For more information, see https://www.postgresql.org/docs/9.1/sql-set-transaction.html
 */
export default interface TransactionOptions {
  /**
   * The default level is "READ_COMMITTED", but you can also this using `default_transaction_isolation`
   *
   * For more information, see: https://www.postgresql.org/docs/9.6/transaction-iso.html
   */
  isolationLevel?: IsolationLevel;
  /**
   * The default value is `false`, but you can also set this using `default_transaction_read_only`
   */
  readOnly?: boolean;
  /**
   * The DEFERRABLE transaction property has no effect unless the
   * transaction is also SERIALIZABLE and READ ONLY. When all of
   * these properties are set on a transaction, the transaction may
   * block when first acquiring its snapshot, after which it is able
   * to run without the normal overhead of a SERIALIZABLE transaction
   * and without any risk of contributing to or being canceled by a
   * serialization failure. This mode is well suited for long-running
   * reports or backups.
   *
   * The default value is `false`, but you can also this using `default_transaction_deferrable`
   */
  deferrable?: boolean;

  retrySerializationFailures?: boolean | number;
}
