import {SQLQuery} from '@databases/pg';
import {Columns} from './Columns';

export default interface TableSchema<TRecord> {
  readonly __getType?: () => TRecord;
  tableName: string;
  tableId: SQLQuery;
  columns: Columns<TRecord>;
}
