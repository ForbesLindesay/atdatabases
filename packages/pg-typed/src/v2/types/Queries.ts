import {SQLQuery} from '@databases/pg';
import AliasedQuery from '../AliasedQuery';
import {TypedDatabaseQuery} from './TypedDatabaseQuery';

export interface ProjectedLimitQuery<TRecord>
  extends TypedDatabaseQuery<TRecord[]> {
  /**
   * Get the SQL query that would be executed. This is useful if you want to use this query as a sub-query in a query that is not type safe.
   */
  toSql(): SQLQuery;

  /**
   * If this is a complex query:
   *   Wrap the entire query in parentheses, and give it an alias. This lets you use joins, group by, etc. as sub-queries.
   *
   * If this is a simple query:
   *   Give the table an alias. This lets you use it in a join.
   */
  as<TAliasTableName extends string>(
    alias: TAliasTableName,
  ): AliasedQuery<TAliasTableName, TRecord>;
}

export interface ProjectedDistinctQuery<TRecord>
  extends ProjectedLimitQuery<TRecord> {
  /**
   * If the query returns exactly one row, it is returned.
   * Throws an error if multiple rows are returned by the query.
   * Returns undefined if no rows are returned by the query.
   */
  one(): TypedDatabaseQuery<TRecord | undefined>;

  /**
   * If the query returns exactly one row, it is returned.
   * Throws an error if multiple rows are returned by the query.
   * Throws an error if no rows are returned by the query.
   */
  oneRequired(): TypedDatabaseQuery<TRecord>;

  /**
   * Returns the first row, or undefined if there are no rows.
   * This will automatically add `LIMIT 1` to the query.
   *
   * If you want the raw SQL query, you should call `.limit(1).toSql()` instead.
   */
  first(): TypedDatabaseQuery<TRecord | undefined>;

  limit(count: number): ProjectedLimitQuery<TRecord>;
}

export interface ProjectedSortedQuery<TRecord>
  extends ProjectedDistinctQuery<TRecord> {
  orderByAsc(columnName: keyof TRecord): ProjectedSortedQuery<TRecord>;
  orderByDesc(columnName: keyof TRecord): ProjectedSortedQuery<TRecord>;
}

export interface ProjectedDistinctColumnsQuery<TRecord>
  extends ProjectedSortedQuery<TRecord> {
  orderByAscDistinct(
    columnName: keyof TRecord,
  ): ProjectedDistinctColumnsQuery<TRecord>;
  orderByDescDistinct(
    columnName: keyof TRecord,
  ): ProjectedDistinctColumnsQuery<TRecord>;
}

export interface ProjectedQuery<TRecord>
  extends ProjectedDistinctColumnsQuery<TRecord> {
  distinct(): ProjectedDistinctQuery<TRecord>;
}
