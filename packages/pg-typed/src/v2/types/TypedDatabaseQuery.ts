import {SQLQuery} from '@databases/pg';

export interface Queryable {
  query(query: SQLQuery): Promise<any[]>;
}

export interface TypedDatabaseQuery<TResult> {
  executeQuery(database: Queryable): Promise<TResult>;
}
