import {Readable} from 'stream';
import sql, {SQLQuery} from '@databases/sql';
import {BigQuery} from '@google-cloud/bigquery';
import BigQueryClient from '../types/BigQueryClient';
import BigQueryDriver from './BigQueryDriver';
import BigQueryDatasetImplementation from './BigQueryDataset';
import BigQueryDataset from '../types/BigQueryDataset';
import BigQueryStreamOptions from '../types/BigQueryStreamOptions';

export default class BigQueryClientImplementation implements BigQueryClient {
  public readonly sql = sql;
  private readonly _client: BigQuery;
  private readonly _driver: BigQueryDriver;
  constructor(client: BigQuery, driver: BigQueryDriver) {
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

  dataset(name: string): BigQueryDataset {
    return new BigQueryDatasetImplementation(
      this._client.dataset(name),
      this._driver,
    );
  }
}
