import {QueryConfig} from 'pg';

// QueryResult<any>> | Promise<QueryResult<any>[]
type RawQueryFunction = (
  query: string | QueryConfig,
  values?: any[],
) => Promise<unknown>;
export default RawQueryFunction;
// query<T extends Submittable>(queryStream: T): T;
// // tslint:disable:no-unnecessary-generics
// query<R extends any[] = any[], I extends any[] = any[]>(
//     queryConfig: QueryArrayConfig<I>,
//     values?: I,
// ): Promise<QueryArrayResult<R>>;
// query<R extends QueryResultRow = any, I extends any[] = any[]>(
//     queryConfig: QueryConfig<I>,
// ): Promise<QueryResult<R>>;
// query<R extends QueryResultRow = any, I extends any[] = any[]>(
//     queryTextOrConfig: string | QueryConfig<I>,
//     values?: I,
// ): Promise<QueryResult<R>>;
// query<R extends any[] = any[], I extends any[] = any[]>(
//     queryConfig: QueryArrayConfig<I>,
//     callback: (err: Error, result: QueryArrayResult<R>) => void,
// ): void;
// query<R extends QueryResultRow = any, I extends any[] = any[]>(
//     queryTextOrConfig: string | QueryConfig<I>,
//     callback: (err: Error, result: QueryResult<R>) => void,
// ): void;
// query<R extends QueryResultRow = any, I extends any[] = any[]>(
//     queryText: string,
//     values: I,
//     callback: (err: Error, result: QueryResult<R>) => void,
// ): void;
