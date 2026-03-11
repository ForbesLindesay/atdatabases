import {type SQL, type SQLQuery} from '@databases/sql';

export default interface Queryable {
  readonly sql: SQL;
  query(query: SQLQuery): Promise<any[]>;
  query(query: SQLQuery[]): Promise<any[][]>;
  queryStream(query: SQLQuery): ReadableStream<any>;
}
