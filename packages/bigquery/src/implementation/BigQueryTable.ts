import {Table} from '@google-cloud/bigquery';
import BigQueryTable, {InsertOptions} from '../types/BigQueryTable';
import {throwError} from './BigQueryDriver';

export default class BigQueryTableImplementation implements BigQueryTable {
  private readonly _client: Table;
  constructor(client: Table) {
    this._client = client;
  }
  async insert(rows: any[], options?: InsertOptions) {
    try {
      await this._client.insert(rows, options);
    } catch (ex) {
      throwError(ex);
    }
  }
}
