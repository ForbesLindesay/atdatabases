import {readFileSync} from 'fs';
import sqlBase, {
  SQL as SQLBase,
  SQLQuery,
  SQLItem,
  SQLItemType,
  FormatConfig,
  isSqlQuery,
} from './web';

export type {SQLQuery, SQLItem, FormatConfig};
export {isSqlQuery, SQLItemType};
export interface SQL extends SQLBase {
  file(filename: string): SQLQuery;
}

// Create the SQL interface we export.
const sql: SQL = Object.assign(sqlBase, {
  file: (filename: string) =>
    sqlBase.__dangerous__rawValue(readFileSync(filename, 'utf8')),
});

export default sql;

module.exports = sql;
module.exports.default = sql;
module.exports.isSqlQuery = isSqlQuery;
module.exports.SQLItemType = SQLItemType;
