import {TableMetadata} from '@google-cloud/bigquery';
import BigQueryFieldSchema from './BigQueryFieldSchema';
import BigQueryPartition from './BigQueryPartition';
import BigQueryTableType from './BigQueryTableType';

export interface CreateTableOptionsBase {
  /**
   * A user-friendly description of this table.
   */
  description?: string;
  /**
   * Custom encryption configuration (e.g., Cloud KMS keys).
   */
  encryptionConfiguration?: {
    /**
     * Describes the Cloud KMS encryption key that will be used to protect destination BigQuery table. The BigQuery Service Account associated with your project requires access to this encryption key.
     */
    kmsKeyName?: string;
  };
  /**
   * The time when this table expires, in milliseconds since the epoch. If not present, the table will persist indefinitely. Expired tables will be deleted and their storage reclaimed. The defaultTableExpirationMs property of the encapsulating dataset can be used to set a default expirationTime on newly created tables.
   */
  expirationTime?: string;
  /**
   * A descriptive name for this table.
   */
  friendlyName?: string;
  /**
   * The labels associated with this table. You can use these to organize and group your tables. Label keys and values can be no longer than 63 characters, can only contain lowercase letters, numeric characters, underscores and dashes. International characters are allowed. Label values are optional. Label keys must start with a letter and each label in the list must have a different key.
   */
  labels?: {[key: string]: string};
}

export interface CreateMaterializedViewOptions extends CreateTableOptionsBase {
  type: BigQueryTableType.MaterializedView;
  /**
   * A query whose result is persisted.
   */
  query: string;
  /**
   * Enable automatic refresh of the materialized view when the base table is updated. The default value is "true".
   */
  enableRefresh?: boolean;
  /**
   * The maximum frequency at which this materialized view will be refreshed. The default value is "1800000" (30 minutes).
   */
  refreshIntervalMilliseconds?: number;

  partition?: BigQueryPartition;
}

export interface CreateViewOptions extends CreateTableOptionsBase {
  type: BigQueryTableType.View;
  /**
   * A query that BigQuery executes when the view is referenced.
   */
  query: string;
  /**
   * Specifies whether to use BigQuery's legacy SQL for this view. The default value is true. If set to false, the view will use BigQuery's standard SQL: https://cloud.google.com/bigquery/sql-reference/ Queries and views that reference this view must use the same flag value.
   */
  useLegacySql: boolean;
}

export interface CreateExternalTableOptions extends CreateTableOptionsBase {
  type: BigQueryTableType.External;

  source: Exclude<TableMetadata['externalDataConfiguration'], undefined>;
}

export interface CreateStandardTableOptions extends CreateTableOptionsBase {
  type: BigQueryTableType.Table;

  fields: BigQueryFieldSchema[];
  partition?: BigQueryPartition;
}

type CreateTableOptions =
  | CreateMaterializedViewOptions
  | CreateViewOptions
  | CreateExternalTableOptions
  | CreateStandardTableOptions;
export default CreateTableOptions;
