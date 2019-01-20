// Type definitions for websql
// Project: http://www.w3.org/TR/webdatabase/
// Definitions by: TeamworkGuy2 <https://github.com/TeamworkGuy2>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

// W3C spec: http://www.w3.org/TR/webdatabase/#database
// Spec revision: 2010-11-18
// NOTE: the W3C websql spec has been deprecated

// uncomment to integrate with Window global object
// interface Window extends WindowDatabase {}
// interface WorkerUtils extends WorkerUtilsDatabase {}

export type OpenDatabase = (
  name: string,
  version: string,
  displayName: string,
  estimatedSize: number,
  creationCallback?: (database: Database) => void,
) => Database;

/** 4.3 Asynchronous database API - The transaction() and readTransaction() methods takes
 * one to three arguments. When called, these methods must immediately return and then
 * asynchronously run the transaction steps with the transaction callback being the
 * first argument, the error callback being the second argument, if any, the success
 * callback being the third argument, if any, and with no preflight operation or
 * postflight operation
 */
export interface Database {
  readonly version: string;

  transaction(
    callback: (transaction: SQLTransaction) => void,
    errorCallback?: (error: SQLError) => void,
    successCallback?: () => void,
  ): void;

  readTransaction(
    callback: (transaction: SQLTransaction) => void,
    errorCallback?: (error: SQLError) => void,
    successCallback?: () => void,
  ): void;

  /**
   * The changeVersion() method allows scripts to atomically verify the version number and change
   * it at the same time as doing a schema update. When the method is invoked, it must immediately
   * return, and then asynchronously run the transaction steps with the transaction callback being
   * the third argument, the error callback being the fourth argument, the success callback being
   * the fifth argument
   */
  changeVersion(
    oldVersion: string,
    newVersion: string,
    callback?: (transaction: SQLTransaction) => void,
    errorCallback?: (error: SQLError) => void,
    successCallback?: () => void,
  ): void;
}

/** 4.3.1 Executing SQL statements
 */
export interface SQLTransaction {
  executeSql(
    sqlStatement: string,
    args?: unknown[],
    callback?: (transaction: SQLTransaction, resultSet: SQLResultSet) => void,
    errorCallback?: (transaction: SQLTransaction, error: SQLError) => boolean,
  ): void;
}

/** 4.5 Database query results
 * The insertId attribute must return the row ID of the row that the SQLResultSet
 * object's SQL statement inserted into the database, if the statement inserted a row.
 * If the statement inserted multiple rows, the ID of the last row must be the one returned.
 * If the statement did not insert a row, then the attribute must instead raise an INVALID_ACCESS_ERR exception.
 *
 * The rowsAffected attribute must return the number of rows that were changed by the SQL statement.
 * If the statement did not affected any rows, then the attribute must return zero.
 * For "SELECT" statements, this returns zero (querying the database doesn't affect any rows).
 *
 * The rows attribute must return a SQLResultSetRowList representing the rows returned,
 * in the order returned by the database. The same object must be returned each time.
 * If no rows were returned, then the object will be empty (its length will be zero)
 */
export interface SQLResultSet {
  insertId: number;
  rowsAffected: number;
  rows: SQLResultSetRowList;
}

/** SQLResultSetRowList objects have a length attribute that must return the number of
 * rows it represents (the number of rows returned by the database). This is the length.
 * Fetching the length might be expensive, and authors are thus encouraged to avoid using
 * it (or enumerating over the object, which implicitly uses it) where possible.
 * The object's supported property indices are the numbers in the range zero to length-1,
 * unless the length is zero, in which case there are no supported property indices.
 * The item(index) attribute must return the row with the given index index.
 * If there is no such row, then the method must return null.
 *
 * Each row must be represented by a native ordered dictionary data type. In the
 * JavaScript binding, this must be Object. Each row object must have one property
 * (or dictionary entry) per column, with those properties enumerating in the order
 * that these columns were returned by the database. Each property must have the
 * name of the column and the value of the cell, as they were returned by the database
 */
export interface SQLResultSetRowList {
  length: number;
  item(index: number): any;
}

/** 4.6 Errors and exceptions - asynchronous database API error
 */
export interface SQLError extends Error {
  code: number;
  message: string;
}
