import {SQLQuery} from '@databases/pg';
import AliasedQuery from './AliasedQuery';
import {TypedDatabaseQuery} from './types/TypedDatabaseQuery';

export default interface ProjectedLimitQuery<TRecord>
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
