import {SQLQuery} from '@databases/pg';
import {Columns} from './types/Columns';

export default interface TableSchema<TRecord> {
  __getType(): TRecord;
  tableName: string;
  tableId: SQLQuery;
  columns: Columns<TRecord>;
}
