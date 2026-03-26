export {default as TableType} from './enums/TableType';
export {default as DataType} from './enums/DataType';

export type {ColumnType} from './getColumnType';
export type {Column} from './getColumns';
export type {Constraint} from './getConstraints';

export type {
  Queryable,
  ConnectionPool,
  SchemaQuery,
  TableDetails,
  Schema,
} from './getSchema';
export {default, connect, sql} from './getSchema';
