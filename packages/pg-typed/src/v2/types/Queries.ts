import {SQLQuery} from '@databases/pg';

import {Columns, InnerJoinedColumns, LeftOuterJoinedColumns} from './Columns';
import {TypedDatabaseQuery} from './TypedDatabaseQuery';
import {NonAggregatedValue} from './SpecialValues';
import {
  AggregatedSelectionSet,
  SelectionSet,
  SelectionSetObject,
} from './SelectionSet';
import WhereCondition from './WhereCondition';

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

export interface AliasedQuery<TAlias extends string, TRecord>
  extends SelectQuery<TRecord>,
    JoinableQueryRight<TAlias, TRecord>,
    JoinableQueryLeft<{
      [TKey in TAlias]: Columns<TRecord>;
    }> {
  where(
    condition: WhereCondition<TRecord, Columns<TRecord>>,
  ): AliasedQuery<TAlias, TRecord>;
}

export interface JoinableQueryLeft<TLeftTables> {
  innerJoin<TRightAlias extends string, TRightRecord>(
    otherQuery: JoinableQueryRight<TRightAlias, TRightRecord>,
  ): JoinQueryBuilder<
    InnerJoinedColumns<TLeftTables, TRightAlias, TRightRecord>
  >;
  leftOuterJoin<TRightAlias extends string, TRightRecord>(
    otherQuery: JoinableQueryRight<TRightAlias, TRightRecord>,
  ): JoinQueryBuilder<
    LeftOuterJoinedColumns<TLeftTables, TRightAlias, TRightRecord>
  >;
}

export interface JoinableQueryRight<TAlias extends string, TRightRecord>
  extends ProjectedLimitQuery<TRightRecord> {
  alias: TAlias;
}

export interface JoinQueryBuilder<TColumns> {
  on(
    predicate: (column: TColumns) => NonAggregatedValue<boolean>,
  ): JoinQuery<TColumns>;
}

export interface JoinQuery<TColumns> extends JoinableQueryLeft<TColumns> {
  select<TSelection>(
    selection: (column: TColumns) => SelectionSet<TSelection>,
  ): ProjectedQuery<TSelection>;
  groupBy<TSelection>(
    selection: (column: TColumns) => SelectionSetObject<TSelection>,
  ): GroupByQuery<TSelection, TColumns>;
  selectAggregate<TAggregation>(
    aggregation: (column: TColumns) => AggregatedSelectionSet<TAggregation>,
  ): AggregatedQuery<TAggregation>;

  where(
    predicate: (column: TColumns) => NonAggregatedValue<boolean>,
  ): JoinQuery<TColumns>;
}

export interface GroupByQuery<TSelection, TColumns> {
  selectAggregate<TAggregation>(
    aggregation: (column: TColumns) => AggregatedSelectionSet<TAggregation>,
  ): ProjectedSortedQuery<TSelection & TAggregation>;
}

export interface SelectQuery<TRecord> extends ProjectedQuery<TRecord> {
  where(
    condition: WhereCondition<TRecord, Columns<TRecord>>,
  ): SelectQuery<TRecord>;

  select<TColumnNames extends (keyof TRecord)[]>(
    ...columnNames: TColumnNames
  ): ProjectedQuery<Pick<TRecord, TColumnNames[number]>>;
  select<TSelection>(
    selection: (column: Columns<TRecord>) => SelectionSet<TSelection>,
  ): ProjectedQuery<TSelection>;

  groupBy<TColumnNames extends (keyof TRecord)[]>(
    ...columnNames: TColumnNames
  ): GroupByQuery<Pick<TRecord, TColumnNames[number]>, Columns<TRecord>>;
  groupBy<TSelection>(
    selection: (column: Columns<TRecord>) => SelectionSetObject<TSelection>,
  ): GroupByQuery<TSelection, Columns<TRecord>>;

  selectAggregate<TAggregation>(
    aggregation: (
      column: Columns<TRecord>,
    ) => AggregatedSelectionSet<TAggregation>,
  ): AggregatedQuery<TAggregation>;
}

export interface AggregatedQuery<TRecord> extends TypedDatabaseQuery<TRecord> {
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
