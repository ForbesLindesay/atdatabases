import {Readable} from 'stream';
import assertNever from 'assert-never';
import sql, {SQLQuery} from '@databases/sql';
import {Dataset, TableMetadata} from '@google-cloud/bigquery';
import BigQueryDriver from './BigQueryDriver';
import BigQueryDataset from '../types/BigQueryDataset';
import BigQueryTable from '../types/BigQueryTable';
import BigQueryTableImplementation from './BigQueryTable';
import CreateTableOptions from '../types/CreateTableOptions';
import BigQueryTableType from '../types/BigQueryTableType';
import BigQueryPartition from '../types/BigQueryPartition';
import BigQueryPartitionType from '../types/BigQueryPartitionType';
import BigQueryStreamOptions from '../types/BigQueryStreamOptions';

function addPartitioning(
  metadata: TableMetadata,
  partition?: BigQueryPartition,
): TableMetadata {
  switch (partition?.type) {
    case undefined:
      return metadata;
    case BigQueryPartitionType.Time:
      return {
        ...metadata,
        timePartitioning: {
          type: partition.granularity,
          expirationMs: partition.expirationMilliseconds?.toString(10),
          field: partition.field,
          requirePartitionFilter: partition.requirePartitionFilter,
        },
        clustering: partition.clusterFields
          ? {fields: partition.clusterFields}
          : undefined,
        requirePartitionFilter: partition.requirePartitionFilter,
      };
    case BigQueryPartitionType.Range:
      return {
        ...metadata,
        rangePartitioning: {
          field: partition.field,
          range: {
            start: partition.start.toString(),
            interval: partition.interval.toString(),
            end: partition.end.toString(),
          },
        },
        clustering: partition.clusterFields
          ? {fields: partition.clusterFields}
          : undefined,
        requirePartitionFilter: partition.requirePartitionFilter,
      };
    default:
      return assertNever(partition);
  }
}
function getTableMetadata(options: CreateTableOptions): TableMetadata {
  switch (options.type) {
    case BigQueryTableType.View:
      return {
        description: options.description,
        encryptionConfiguration: options.encryptionConfiguration,
        expirationTime: options.expirationTime,
        friendlyName: options.friendlyName,
        labels: options.labels,
        view: {
          query: options.query,
          useLegacySql: options.useLegacySql,
        },
      };
    case BigQueryTableType.MaterializedView:
      return addPartitioning(
        {
          description: options.description,
          encryptionConfiguration: options.encryptionConfiguration,
          expirationTime: options.expirationTime,
          friendlyName: options.friendlyName,
          labels: options.labels,
          materializedView: {
            query: options.query,
            enableRefresh: options.enableRefresh,
            refreshIntervalMs: options.refreshIntervalMilliseconds?.toString(
              10,
            ),
          },
        },
        options.partition,
      );
    case BigQueryTableType.External:
      return {
        description: options.description,
        encryptionConfiguration: options.encryptionConfiguration,
        expirationTime: options.expirationTime,
        friendlyName: options.friendlyName,
        labels: options.labels,
        externalDataConfiguration: options.source,
      };
    case BigQueryTableType.Table:
      return addPartitioning(
        {
          description: options.description,
          encryptionConfiguration: options.encryptionConfiguration,
          expirationTime: options.expirationTime,
          friendlyName: options.friendlyName,
          labels: options.labels,
          schema: {
            fields: options.fields,
          },
        },
        options.partition,
      );
    default:
      return assertNever(options);
  }
}

export default class BigQueryDatasetImplementation implements BigQueryDataset {
  public readonly sql = sql;
  private readonly _client: Dataset;
  private readonly _driver: BigQueryDriver;
  constructor(client: Dataset, driver: BigQueryDriver) {
    this._client = client;
    this._driver = driver;
  }
  private readonly _createQueryJob = async (q: {
    query: string;
    params: any;
  }) => {
    const [job] = await this._client.createQueryJob(q);
    return job;
  };

  async query(query: SQLQuery | SQLQuery[]): Promise<any[]> {
    return await this._driver.query(query, this._createQueryJob);
  }

  queryStream(
    query: SQLQuery,
    options: BigQueryStreamOptions = {},
  ): AsyncGenerator<any, void, unknown> {
    return this._driver.queryStream(query, options, this._createQueryJob);
  }

  queryNodeStream(
    query: SQLQuery,
    options: BigQueryStreamOptions = {},
  ): Readable {
    return this._driver.queryNodeStream(query, options, this._createQueryJob);
  }

  async createTable(
    name: string,
    options: CreateTableOptions,
  ): Promise<BigQueryTable> {
    await this._client.createTable(name, getTableMetadata(options));
    return new BigQueryTableImplementation(this._client.table(name));
  }
  table(name: string): BigQueryTable {
    return new BigQueryTableImplementation(this._client.table(name));
  }
}
