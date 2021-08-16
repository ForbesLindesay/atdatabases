import sql, {SQLQuery, isSqlQuery} from '@databases/sql';
import {
  BigQuery,
  BigQueryDate,
  BigQueryDatetime,
  BigQueryInt,
  BigQueryOptions,
  BigQueryTime,
  BigQueryTimestamp,
  Geography,
} from '@google-cloud/bigquery';
import Big from 'big.js';
import BigQueryClientImplementation from './implementation/BigQueryClient';
import BigQueryClient from './types/BigQueryClient';
import BigQueryDriver from './implementation/BigQueryDriver';
import BigQueryDataset from './types/BigQueryDataset';
import BigQueryTable from './types/BigQueryTable';
import BigQueryTableType from './types/BigQueryTableType';
import BigQueryPartitionType from './types/BigQueryPartitionType';
import BigQueryFieldSchema from './types/BigQueryFieldSchema';
import CreateTableOptions, {
  CreateMaterializedViewOptions,
  CreateViewOptions,
  CreateExternalTableOptions,
  CreateStandardTableOptions,
} from './types/CreateTableOptions';
import Queryable from './types/Queryable';

export interface ConnectionOptions extends BigQueryOptions {
  /**
   * How would you like bigints to be returned from the database?
   *
   * If you choose `number` you may get inexact values for numbers greater than Number.MAX_SAFE_INTEGER
   *
   * We default to BigQueryInt to match the other data types in bigquery, since google do not provide a convenient way to override their parsing.
   *
   * @default 'BigQueryInt'
   */
  bigIntMode?: 'number' | 'string' | 'bigint' | 'BigQueryInt';
  /**
   * The geographic location where the job should run. Required except for US and EU. See details at https://cloud.google.com/bigquery/docs/locations#specifying_your_location.
   */
  location?: string;
}

function shouldWrapIntegers(bigIntMode: ConnectionOptions['bigIntMode']) {
  switch (bigIntMode) {
    case 'number':
      return {integerTypeCastFunction: (value: string) => parseInt(value, 10)};
    case 'string':
      return {integerTypeCastFunction: (value: string) => `${value}`};
    case 'bigint':
      return {integerTypeCastFunction: (value: string) => BigInt(value)};
    case 'BigQueryInt':
    case undefined:
      return true;
  }
}

export {sql, isSqlQuery, BigQueryTableType, BigQueryPartitionType};
export type {
  SQLQuery,
  Queryable,
  BigQueryClient,
  BigQueryDataset,
  BigQueryTable,
  BigQueryFieldSchema,
  CreateMaterializedViewOptions,
  CreateViewOptions,
  CreateExternalTableOptions,
  CreateStandardTableOptions,
  CreateTableOptions,
};
// data types
export {
  // INTEGER & INT64
  BigQueryInt,
  // NUMERIC & BIGNUMERIC
  Big,
  // DATE
  BigQueryDate,
  // DATETIME
  BigQueryDatetime,
  // TIME
  BigQueryTime,
  // TIMESTAMP
  BigQueryTimestamp,
  // GEOGRAPHY
  Geography,
};

export default function connect({
  bigIntMode,
  location,
  ...constructorOptions
}: ConnectionOptions = {}): BigQueryClient {
  return new BigQueryClientImplementation(
    new BigQuery({
      ...(location ? {location} : {}),
      ...constructorOptions,
    }),
    new BigQueryDriver({
      location,
      wrapIntegers: shouldWrapIntegers(bigIntMode),
    }),
  );
}

module.exports = Object.assign(connect, {
  default: connect,
  sql,
  isSqlQuery,
  BigQueryTableType,
  BigQueryPartitionType,
  BigQueryInt,
  Big,
  BigQueryDate,
  BigQueryDatetime,
  BigQueryTime,
  BigQueryTimestamp,
  Geography,
});
