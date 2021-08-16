import sql, {SQLQuery} from '@databases/sql';
import {Readable} from 'stream';

export default interface Queryable {
  readonly sql: typeof sql;
  query(query: SQLQuery): Promise<any[]>;
  query(query: SQLQuery[]): Promise<any[][]>;
  queryStream(query: SQLQuery): AsyncGenerator<any, void, unknown>;
  queryNodeStream(query: SQLQuery): Readable;
}
