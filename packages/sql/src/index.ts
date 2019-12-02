import SQLQuery from './SQLQuery';

export {SQLQuery};

/**
 * The interface we actually expect people to use.
 */
export interface SQL {
  (strings: TemplateStringsArray, ...values: Array<any>): SQLQuery;

  // tslint:disable:unified-signatures
  /**
   * Joins multiple queries together and puts a separator in between if a
   * separator was defined.
   */
  join(queries: Array<SQLQuery>, separator?: SQLQuery): SQLQuery;
  /**
   * Joins multiple queries together and puts a separator in between if a
   * separator was defined.
   */
  join(
    queries: Array<SQLQuery>,
    separator: ',' | ', ' | ' AND ' | ' OR ',
  ): SQLQuery;
  /**
   * Joins multiple queries together and puts a separator in between if a
   * separator was defined.
   *
   * @deprecated please do not pass the separator as a string, use sql`` to mark it as an SQL string
   */
  join(queries: Array<SQLQuery>, separator: string): SQLQuery;
  // tslint:enable:unified-signatures
  __dangerous__rawValue(text: string): SQLQuery;
  file(filename: string): SQLQuery;
  value(value: any): SQLQuery;
  ident(...names: Array<any>): SQLQuery;
  registerFormatter<T>(
    constructor: new (...args: any[]) => T,
    format: (value: T) => SQLQuery,
  ): void;
}

// Create the SQL interface we export.
const modifiedSQL: SQL = Object.assign(
  (strings: TemplateStringsArray, ...values: Array<any>): SQLQuery =>
    SQLQuery.query(strings, ...values),
  {
    // tslint:disable:no-unbound-method
    // tslint:disable-next-line:deprecation
    join: SQLQuery.join,
    __dangerous__rawValue: SQLQuery.raw,
    file: SQLQuery.file,
    value: SQLQuery.value,
    ident: SQLQuery.ident,
    registerFormatter: SQLQuery.registerFormatter,
    // tslint:enable:no-unbound-method
  },
);

export default modifiedSQL;

module.exports = modifiedSQL;
module.exports.default = modifiedSQL;
module.exports.SQLQuery = SQLQuery;
