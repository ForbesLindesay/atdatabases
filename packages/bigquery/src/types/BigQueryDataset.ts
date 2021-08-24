import BigQueryTable from './BigQueryTable';
import CreateTableOptions from './CreateTableOptions';
import Queryable from './Queryable';

export default interface BigQueryDataset extends Queryable {
  createTable(
    name: string,
    options: CreateTableOptions,
  ): Promise<BigQueryTable>;
  table(name: string): BigQueryTable;
}
