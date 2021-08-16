import BigQueryPartitionType from './BigQueryPartitionType';

export interface TimePartition {
  type: BigQueryPartitionType.Time;

  /**
   * The supported types are DAY, HOUR, MONTH, and YEAR, which will generate one partition per day, hour, month, and year, respectively.
   */
  granularity: 'HOUR' | 'DAY' | 'MONTH' | 'YEAR';

  /**
   * Number of milliseconds for which to keep the storage for partitions in the table. The storage in a partition will have an expiration time of its partition time plus this value.
   */
  expirationMilliseconds?: number;

  /**
   * If not set, the table is partitioned by pseudo column, referenced via either '_PARTITIONTIME' as TIMESTAMP type, or '_PARTITIONDATE' as DATE type. If field is specified, the table is instead partitioned by this field. The field must be a top-level TIMESTAMP or DATE field. Its mode must be NULLABLE or REQUIRED.
   */
  field?: string;

  /**
   * If set to true, queries over this table require a partition filter that can be used for partition elimination to be specified.
   */
  requirePartitionFilter?: boolean;

  /**
   * One or more fields on which data should be clustered. Only top-level, non-repeated, simple-type fields are supported. When you cluster a table using multiple columns, the order of columns you specify is important. The order of the specified columns determines the sort order of the data.
   */
  clusterFields?: string[];
}

export interface RangePartition {
  type: BigQueryPartitionType.Range;

  /**
   * The table is partitioned by this field. The field must be a top-level NULLABLE/REQUIRED field. The only supported type is INTEGER/INT64.
   */
  field: string;

  /**
   * The start of range partitioning, inclusive.
   */
  start: string | number;

  /**
   * The width of each interval.
   */
  interval: string | number;

  /**
   * The end of range partitioning, exclusive.
   */
  end: string | number;

  /**
   * If set to true, queries over this table require a partition filter that can be used for partition elimination to be specified.
   */
  requirePartitionFilter?: boolean;

  /**
   * One or more fields on which data should be clustered. Only top-level, non-repeated, simple-type fields are supported. When you cluster a table using multiple columns, the order of columns you specify is important. The order of the specified columns determines the sort order of the data.
   */
  clusterFields?: string[];
}

type BigQueryPartition = TimePartition | RangePartition;

export default BigQueryPartition;
