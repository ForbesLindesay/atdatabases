import {readFileSync} from 'fs';
import sqlBase, {
  type SQL as SQLBase,
  type SQLQuery,
  type SQLItem,
  SQLItemType,
  type FormatConfig,
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
