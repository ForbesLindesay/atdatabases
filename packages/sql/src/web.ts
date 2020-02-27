// @public

import SQLQuery from './SQLQuery';
import SQL from './SQL';

export {SQLQuery, SQL};

// Create the SQL interface we export.
const modifiedSQL: SQL = Object.assign(
  (strings: TemplateStringsArray, ...values: Array<any>): SQLQuery =>
    SQLQuery.query(strings, ...values),
  {
    // tslint:disable:no-unbound-method
    // tslint:disable-next-line:deprecation
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
