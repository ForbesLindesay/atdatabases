import BigQueryDataset from './BigQueryDataset';
import Queryable from './Queryable';

export default interface BigQueryClient extends Queryable {
  dataset(name: string): BigQueryDataset;
}
