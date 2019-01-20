import SQLQuery from './SQLQuery';

export {SQLQuery};

/**
 * The interface we actually expect people to use.
 */
export interface SQL {
  (strings: TemplateStringsArray, ...values: Array<any>): SQLQuery;

  join(queries: Array<SQLQuery>, seperator?: string): SQLQuery;
  __dangerous__rawValue(text: string): SQLQuery;
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
    join: SQLQuery.join,
    __dangerous__rawValue: SQLQuery.raw,
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
