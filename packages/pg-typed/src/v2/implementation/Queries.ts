import {SQLQuery, sql} from '@databases/pg';
import {escapePostgresIdentifier} from '@databases/escape-identifier';

import {aliasColumns, columns} from './Columns';
import WhereCondition from '../types/WhereCondition';
import {
  FieldCondition,
  NonAggregatedValue,
  isSpecialValue,
} from '../types/SpecialValues';
import {
  ColumnReference,
  Columns,
  InnerJoinedColumns,
  LeftOuterJoinedColumns,
} from '../types/Columns';
import Operators, {
  aliasTableInValue,
  fieldConditionToPredicateValue,
  valueToSelect,
  valueToSql,
} from './Operators';
import {
  AggregatedSelectionSet,
  SelectionSet,
  SelectionSetObject,
} from '../types/SelectionSet';
import {Queryable, TypedDatabaseQuery} from '../types/TypedDatabaseQuery';
import {
  AggregatedQuery,
  AliasedQuery,
  GroupByQuery,
  JoinableQueryLeft,
  JoinableQueryRight,
  JoinQuery,
  JoinQueryBuilder,
  ProjectedDistinctColumnsQuery,
  ProjectedDistinctQuery,
  ProjectedLimitQuery,
  ProjectedQuery,
  ProjectedSortedQuery,
  SelectQuery,
} from '../types/Queries';
import TableSchema from '../types/TableSchema';

const NO_RESULT_FOUND = `NO_RESULT_FOUND`;
const MULTIPLE_RESULTS_FOUND = `MULTIPLE_RESULTS_FOUND`;

export default function createQuery<TRecord>(
  table: TableSchema<TRecord>,
): SelectQuery<TRecord> {
  return new SelectQueryImplementation({
    columns: table.columns,
    distinct: false,
    distinctColumns: [],
    groupBy: 0,
    hasSideEffects: false,
    isAliased: false,
    isEmpty: false,
    isJoin: false,
    limit: null,
    orderBy: [],
    projection: null,
    tableId: table.tableId,
    tableName: table.tableName,
    where: [],
  });
}
export function createStatementReturn<TRecord, TSelection>(
  table: TableSchema<TRecord>,
  query: SQLQuery | null,
  selection:
    | readonly string[]
    | readonly [(columns: Columns<TRecord>) => SelectionSetObject<TSelection>],
): SelectQuery<TSelection> {
  return new StatementReturning<TSelection>(
    table as any,
    query,
    typeof selection[0] === 'function'
      ? selectionSetToProjection(selection[0](table.columns))
      : selection[0] === '*'
      ? null
      : columnNamesToProjection(selection as string[]),
  );
}

interface Projection {
  /**
   * The SQL for the selection set.
   *
   * e.g. u.name AS user_name, u.email AS user_email, COUNT(*) AS post_count
   */
  readonly query: SQLQuery;
  /**
   * The column names (in order) returned by this projection.
   *
   * e.g. ['user_name', 'user_email', 'post_count']
   *
   * Star is used if the number of columns is unknown
   */
  readonly columnNames: readonly string[];
}

interface CompleteQuery<
  TAlias extends string,
  TRecord,
  TColumns,
  TAliasedColumns,
> extends ProjectedQuery<TRecord>,
    JoinableQueryLeft<TAliasedColumns>,
    JoinableQueryRight<TAlias, TRecord> {
  where(condition: WhereCondition<TRecord, TColumns>): this;

  select<TColumnNames extends (keyof TRecord)[]>(
    ...columnNames: TColumnNames
  ): ProjectedQuery<Pick<TRecord, TColumnNames[number]>>;
  select<TSelection>(
    selection: (column: TColumns) => SelectionSetObject<TSelection>,
  ): ProjectedQuery<TSelection>;

  groupBy<TColumnNames extends (keyof TRecord)[]>(
    ...columnNames: TColumnNames
  ): GroupByQuery<Pick<TRecord, TColumnNames[number]>, TColumns>;
  groupBy<TSelection>(
    selection: (column: TColumns) => SelectionSetObject<TSelection>,
  ): GroupByQuery<TSelection, TColumns>;

  selectAggregate<TAggregation>(
    aggregation: (column: TColumns) => AggregatedSelectionSet<TAggregation>,
  ): AggregatedQuery<TAggregation>;
}

interface QueryConfig<TAlias extends string, TRecord, TColumns> {
  columns: TColumns;
  distinct: boolean;
  distinctColumns: readonly SQLQuery[];
  groupBy: number;
  isAliased: boolean;
  isEmpty: boolean;
  isJoin: boolean;
  hasSideEffects: boolean;
  limit: number | null;
  orderBy: readonly SQLQuery[];
  projection: Projection | null;
  tableId: SQLQuery;
  tableName: TAlias;
  where: readonly NonAggregatedValue<boolean>[];
}

interface FinalQueryConfig {
  query: SQLQuery;
  isEmpty: boolean;
}

abstract class FinalQuery<TRecord, T> implements TypedDatabaseQuery<T> {
  private readonly _q: FinalQueryConfig;
  constructor(q: FinalQueryConfig) {
    this._q = q;
  }
  async executeQuery(database: Queryable): Promise<T> {
    return this._prepareResults(
      this._q.isEmpty ? [] : await database.query(this._q.query),
    );
  }
  protected _queryForError(): string {
    return this._q.query.format({
      escapeIdentifier: escapePostgresIdentifier,
      formatValue: () => ({placeholder: `?`, value: undefined}),
    }).text;
  }
  protected abstract _prepareResults(results: TRecord[]): T;
}

class FirstQuery<TRecord> extends FinalQuery<TRecord, TRecord | undefined> {
  protected _prepareResults(results: TRecord[]): TRecord | undefined {
    if (!results.length) return undefined;
    return results[0];
  }
}

class OneQuery<TRecord> extends FinalQuery<TRecord, TRecord | undefined> {
  protected _prepareResults(results: TRecord[]): TRecord | undefined {
    if (!results.length) return undefined;
    if (results.length > 1) {
      throw Object.assign(
        new Error(
          `More than one row matched this query but we only expected one: ${this._queryForError()}`,
        ),
        {code: MULTIPLE_RESULTS_FOUND},
      );
    }
    return results[0];
  }
}

class OneRequiredQuery<TRecord> extends FinalQuery<TRecord, TRecord> {
  protected _prepareResults(results: TRecord[]): TRecord {
    if (!results.length) {
      throw Object.assign(
        new Error(`No results matched this query: ${this._queryForError()}.`),
        {code: NO_RESULT_FOUND},
      );
    }
    if (results.length > 1) {
      throw Object.assign(
        new Error(
          `More than one row matched this query but we only expected one: ${this._queryForError()}`,
        ),
        {code: MULTIPLE_RESULTS_FOUND},
      );
    }
    return results[0];
  }
}

class SelectQueryImplementation<
  TAlias extends string,
  TRecord,
  TColumns,
  TAliasedColumns,
> implements CompleteQuery<TAlias, TRecord, TColumns, TAliasedColumns>
{
  public readonly alias: TAlias;
  private readonly _config: QueryConfig<TAlias, TRecord, TColumns>;
  constructor(config: QueryConfig<TAlias, TRecord, TColumns>) {
    this.alias = config.tableName;
    this._config = config;
  }

  private _query(): FinalQueryConfig {
    const parts = [sql`SELECT`];

    if (this._config.distinct) {
      parts.push(sql`DISTINCT`);
    }
    if (this._config.distinctColumns.length) {
      parts.push(
        sql`DISTINCT ON (${sql.join(this._config.distinctColumns, `,`)})`,
      );
    }

    parts.push(
      sql`${this._config.projection?.query ?? sql`*`} FROM ${
        this._config.tableId
      }`,
    );

    const whereCondition = Operators.and(...this._config.where);
    if (whereCondition !== true) {
      parts.push(
        sql`WHERE ${valueToSql(whereCondition, {
          toValue: (v) => v,
          tableAlias: () => null,
          parentOperatorPrecedence: null,
        })}`,
      );
    }

    if (this._config.groupBy !== 0) {
      const groupByColumns: number[] = [];
      for (let i = 0; i < this._config.groupBy; i++) {
        groupByColumns.push(i + 1);
      }
      parts.push(
        sql`GROUP BY ${sql.__dangerous__rawValue(groupByColumns.join(`,`))}`,
      );
    }

    if (this._config.orderBy.length) {
      parts.push(sql`ORDER BY ${sql.join(this._config.orderBy, `,`)}`);
    }

    if (this._config.limit !== null) {
      parts.push(sql`LIMIT ${this._config.limit}`);
    }

    return {
      query: sql.join(parts, sql` `),
      isEmpty: whereCondition === false && !this._config.hasSideEffects,
    };
  }

  private _projectedQuery<TRecord>(
    projection: Projection,
  ): ProjectedQuery<TRecord> {
    // Projecting the query (i.e. choosing a selection set) may change the column names and types, so
    // we can no longer use the columns object from the schema, we must create a new one.
    const preparedColumns = columns<TRecord>(
      this._config.tableName,
      projection.columnNames.map((n) => ({columnName: n})),
      this._config.isAliased,
    );
    return new SelectQueryImplementation<
      TAlias,
      TRecord,
      Columns<TRecord>,
      any
    >({
      columns: preparedColumns,
      distinct: this._config.distinct,
      distinctColumns: this._config.distinctColumns,
      groupBy: this._config.groupBy,
      hasSideEffects: this._config.hasSideEffects,
      isAliased: this._config.isAliased,
      isEmpty: this._config.isEmpty,
      isJoin: this._config.isJoin,
      limit: this._config.limit,
      orderBy: this._config.orderBy,
      projection,
      tableId: this._config.tableId,
      tableName: this._config.tableName,
      where: this._config.where,
    });
  }

  toSql(): SQLQuery {
    const {query} = this._query();
    return query;
  }

  as<TAlias extends string>(alias: TAlias): AliasedQuery<TAlias, TRecord> {
    if (!/^[a-z][a-z0-9_]*$/.test(alias)) {
      throw new Error(
        `Table aliases must start with a lower case letter and only contain letters, numbers and underscores`,
      );
    }

    const {
      columns,
      distinct,
      distinctColumns,
      groupBy,
      isAliased,
      isJoin,
      limit,
      orderBy,
      projection,
      tableId,
      tableName,
      where,
    } = this._config;

    const aliasedColumns = aliasColumns(alias, columns as Columns<TRecord>);

    if (
      distinct ||
      distinctColumns.length ||
      groupBy ||
      isJoin ||
      limit ||
      orderBy.length ||
      projection ||
      isAliased
    ) {
      return new SelectQueryImplementation({
        columns: aliasedColumns,
        distinct: false,
        distinctColumns: [],
        groupBy: 0,
        hasSideEffects: this._config.hasSideEffects,
        isAliased: true,
        isEmpty: this._config.isEmpty || Operators.and(...where) === false,
        isJoin: false,
        limit: null,
        orderBy: [],
        projection: null,
        tableId: sql`(${this.toSql()}) AS ${sql.ident(alias)}`,
        tableName: alias,
        where: [],
      });
    }

    return new SelectQueryImplementation({
      columns: aliasedColumns,
      distinct: false,
      distinctColumns: [],
      groupBy: 0,
      hasSideEffects: this._config.hasSideEffects,
      isAliased: true,
      isEmpty: this._config.isEmpty,
      isJoin: false,
      limit: null,
      orderBy: [],
      projection: null,
      tableId: sql`${tableId} AS ${sql.ident(alias)}`,
      tableName: alias,
      where: where.map((c) => aliasTableInValue(tableName, alias, c)),
    });
  }

  where(condition: WhereCondition<TRecord, TColumns>): any {
    const where = [
      ...this._config.where,
      ...(sql.isSqlQuery(condition) ||
      isSpecialValue(condition) ||
      typeof condition === 'boolean'
        ? [condition]
        : typeof condition === 'function'
        ? [condition(this._config.columns)]
        : Object.entries(condition).map(([columnName, value]) =>
            fieldConditionToPredicateValue(
              (this._config.columns as Columns<TRecord>)[
                columnName as keyof Columns<TRecord>
              ] as ColumnReference<TRecord[keyof TRecord]>,
              value as FieldCondition<TRecord[keyof TRecord]>,
            ),
          )),
    ];
    return new SelectQueryImplementation({
      columns: this._config.columns,
      distinct: this._config.distinct,
      distinctColumns: this._config.distinctColumns,
      groupBy: this._config.groupBy,
      hasSideEffects: this._config.hasSideEffects,
      isAliased: this._config.isAliased,
      isEmpty: this._config.isEmpty,
      isJoin: this._config.isJoin,
      limit: this._config.limit,
      orderBy: this._config.orderBy,
      projection: this._config.projection,
      tableId: this._config.tableId,
      tableName: this._config.tableName,
      where,
    });
  }

  select<TSelection>(...selection: any[]): ProjectedQuery<TSelection> {
    return this._projectedQuery(
      selection.length === 1 && typeof selection[0] === 'function'
        ? selectionSetSpecialToProjection(
            selection[0](this._config.columns) as SelectionSet<TSelection>,
          )
        : columnNamesToProjection(selection),
    );
  }

  selectAggregate<TAggregation>(
    aggregation: (column: TColumns) => AggregatedSelectionSet<TAggregation>,
  ): AggregatedQuery<TAggregation> {
    return new AggregatedQueryImplementation(
      this._projectedQuery(
        selectionSetToProjection(aggregation(this._config.columns)),
      ),
    );
  }

  groupBy<TSelection>(...selection: any[]): GroupByQuery<TSelection, TColumns> {
    return new GroupByQueryImplementation<TAlias, TSelection, TColumns>(
      selection.length === 1 && typeof selection[0] === 'function'
        ? selectionSetToProjection(
            selection[0](
              this._config.columns,
            ) as SelectionSetObject<TSelection>,
          )
        : columnNamesToProjection(selection),
      this._config,
    );
  }

  private _orderByColumn(columnName: keyof TRecord): SQLQuery {
    if (
      this._config.projection &&
      !this._config.projection.columnNames.includes(`*`)
    ) {
      const index = this._config.projection.columnNames.indexOf(
        columnName as string,
      );
      if (index !== -1) {
        return sql.__dangerous__rawValue((index + 1).toString(10));
      }
    }
    return sql.ident(columnName);
  }
  private _orderByInternal(
    columnName: keyof TRecord,
    distinct: boolean,
    direction: SQLQuery,
  ): ProjectedDistinctColumnsQuery<TRecord> {
    if (distinct) {
      if (this._config.distinct) {
        throw new Error(
          `Cannot call orderByAscDistinct() or orderByDescDistinct() after distinct()`,
        );
      }
      if (this._config.orderBy.length > this._config.distinctColumns.length) {
        throw new Error(
          `Cannot call orderByAscDistinct() or orderByDescDistinct() after orderByAsc() or orderByDesc()`,
        );
      }
    }
    const distinctColumns = distinct
      ? [...this._config.distinctColumns, sql.ident(columnName)]
      : this._config.distinctColumns;
    const orderBy = [
      ...this._config.orderBy,
      sql`${this._orderByColumn(columnName)} ${direction}`,
    ];
    return new SelectQueryImplementation({
      columns: this._config.columns,
      distinct: this._config.distinct,
      distinctColumns,
      groupBy: this._config.groupBy,
      hasSideEffects: this._config.hasSideEffects,
      isAliased: this._config.isAliased,
      isEmpty: this._config.isEmpty,
      isJoin: this._config.isJoin,
      limit: this._config.limit,
      orderBy,
      projection: this._config.projection,
      tableId: this._config.tableId,
      tableName: this._config.tableName,
      where: this._config.where,
    });
  }

  orderByAscDistinct(
    columnName: keyof TRecord,
  ): ProjectedDistinctColumnsQuery<TRecord> {
    return this._orderByInternal(columnName, true, sql`ASC`);
  }
  orderByDescDistinct(
    columnName: keyof TRecord,
  ): ProjectedDistinctColumnsQuery<TRecord> {
    return this._orderByInternal(columnName, true, sql`DESC`);
  }
  orderByAsc(columnName: keyof TRecord): ProjectedSortedQuery<TRecord> {
    return this._orderByInternal(columnName, false, sql`ASC`);
  }
  orderByDesc(columnName: keyof TRecord): ProjectedSortedQuery<TRecord> {
    return this._orderByInternal(columnName, false, sql`DESC`);
  }

  distinct(): ProjectedDistinctQuery<TRecord> {
    if (this._config.distinct || this._config.distinctColumns.length) {
      throw new Error(
        `Cannot call distinct() after a query has already been marked as distinct.`,
      );
    }
    return new SelectQueryImplementation({
      columns: this._config.columns,
      distinct: true,
      distinctColumns: [],
      groupBy: this._config.groupBy,
      hasSideEffects: this._config.hasSideEffects,
      isAliased: this._config.isAliased,
      isEmpty: this._config.isEmpty,
      isJoin: this._config.isJoin,
      limit: this._config.limit,
      orderBy: this._config.orderBy,
      projection: this._config.projection,
      tableId: this._config.tableId,
      tableName: this._config.tableName,
      where: this._config.where,
    });
  }
  limit(n: number): ProjectedLimitQuery<TRecord> {
    return new SelectQueryImplementation({
      columns: this._config.columns,
      distinct: this._config.distinct,
      distinctColumns: this._config.distinctColumns,
      groupBy: this._config.groupBy,
      hasSideEffects: this._config.hasSideEffects,
      isAliased: this._config.isAliased,
      isEmpty: this._config.isEmpty,
      isJoin: this._config.isJoin,
      limit: n,
      orderBy: this._config.orderBy,
      projection: this._config.projection,
      tableId: this._config.tableId,
      tableName: this._config.tableName,
      where: this._config.where,
    });
  }

  innerJoin<TRightAlias extends string, TRightRecord>(
    otherQuery: JoinableQueryRight<TRightAlias, TRightRecord>,
  ): JoinQueryBuilder<
    InnerJoinedColumns<TAliasedColumns, TRightAlias, TRightRecord>
  > {
    if (
      !(otherQuery instanceof SelectQueryImplementation) ||
      !otherQuery._config.isAliased ||
      otherQuery._config.isJoin
    ) {
      throw new Error(`Right hand side of join is not valid.`);
    }
    const tableId = sql`${this._config.tableId} INNER JOIN ${otherQuery._config.tableId}`;
    const columns: any = Object.assign(
      {[otherQuery._config.tableName]: otherQuery._config.columns},
      this._config.isJoin
        ? this._config.columns
        : {[this._config.tableName]: this._config.columns},
    );
    return new JoinImplementation<
      InnerJoinedColumns<TAliasedColumns, TRightAlias, TRightRecord>
    >(
      {
        columns,
        distinct: this._config.distinct,
        distinctColumns: this._config.distinctColumns,
        groupBy: this._config.groupBy,
        hasSideEffects:
          this._config.hasSideEffects || otherQuery._config.hasSideEffects,
        isAliased: this._config.isAliased,
        isEmpty:
          this._config.isEmpty ||
          otherQuery._config.isEmpty ||
          Operators.and(...otherQuery._config.where) === false,
        isJoin: this._config.isJoin,
        limit: this._config.limit,
        orderBy: this._config.orderBy,
        projection: this._config.projection,
        tableId,
        tableName: this._config.tableName,
        where: this._config.where,
      },
      otherQuery._config.where,
    );
  }

  leftOuterJoin<TRightAlias extends string, TRightRecord>(
    otherQuery: JoinableQueryRight<TRightAlias, TRightRecord>,
  ): JoinQueryBuilder<
    LeftOuterJoinedColumns<TAliasedColumns, TRightAlias, TRightRecord>
  > {
    if (
      !(otherQuery instanceof SelectQueryImplementation) ||
      !otherQuery._config.isAliased ||
      otherQuery._config.isJoin
    ) {
      throw new Error(`Right hand side of join is not valid.`);
    }
    const tableId = sql`${this._config.tableId} LEFT OUTER JOIN ${otherQuery._config.tableId}`;
    const columns: any = Object.assign(
      {[otherQuery._config.tableName]: otherQuery._config.columns},
      this._config.isJoin
        ? this._config.columns
        : {[this._config.tableName]: this._config.columns},
    );
    return new JoinImplementation<
      InnerJoinedColumns<TAliasedColumns, TRightAlias, TRightRecord>
    >(
      {
        columns,
        distinct: this._config.distinct,
        distinctColumns: this._config.distinctColumns,
        groupBy: this._config.groupBy,
        hasSideEffects:
          this._config.hasSideEffects || otherQuery._config.hasSideEffects,
        isAliased: this._config.isAliased,
        isEmpty: this._config.isEmpty,
        isJoin: this._config.isJoin,
        limit: this._config.limit,
        orderBy: this._config.orderBy,
        projection: this._config.projection,
        tableId,
        tableName: this._config.tableName,
        where: this._config.where,
      },
      otherQuery._config.where,
    );
  }

  one(): TypedDatabaseQuery<TRecord | undefined> {
    return new OneQuery(this._query());
  }

  oneRequired(): TypedDatabaseQuery<TRecord> {
    return new OneRequiredQuery(this._query());
  }

  first(): TypedDatabaseQuery<TRecord | undefined> {
    return new FirstQuery(this._query());
  }

  async executeQuery(database: Queryable): Promise<TRecord[]> {
    const {query, isEmpty} = this._query();
    if (isEmpty) return [];
    return await database.query(query);
  }
}

class GroupByQueryImplementation<TAlias extends string, TSelection, TColumns>
  implements GroupByQuery<TSelection, TColumns>
{
  private readonly _groupByProjection: Projection;
  private readonly _config: QueryConfig<TAlias, unknown, TColumns>;
  constructor(
    groupByProjection: Projection,
    config: QueryConfig<TAlias, unknown, TColumns>,
  ) {
    this._groupByProjection = groupByProjection;
    this._config = config;
  }
  selectAggregate<TAggregation>(
    aggregation: (column: TColumns) => AggregatedSelectionSet<TAggregation>,
  ): ProjectedSortedQuery<TSelection & TAggregation> {
    const groupByProjection = this._groupByProjection;
    const aggregatedProjection = selectionSetToProjection(
      aggregation(this._config.columns),
    );
    const columnNames = [
      ...groupByProjection.columnNames,
      ...aggregatedProjection.columnNames,
    ];

    // Projecting the query (i.e. choosing a selection set) may change the column names and types, so
    // we can no longer use the columns object from the schema, we must create a new one.
    const rawColumns = columns<TSelection & TAggregation>(
      this._config.tableName,
      columnNames.map((n) => ({columnName: n})),
    );
    const projectionParts: SQLQuery[] = [];
    if (groupByProjection.columnNames.length) {
      projectionParts.push(groupByProjection.query);
    }
    if (aggregatedProjection.columnNames.length) {
      projectionParts.push(aggregatedProjection.query);
    }
    const projection = {
      query: sql.join(projectionParts, `,`),
      columnNames,
    };
    return new SelectQueryImplementation<
      TAlias,
      TSelection & TAggregation,
      Columns<TSelection & TAggregation>,
      never
    >({
      columns: rawColumns,
      distinct: false,
      distinctColumns: [],
      groupBy: groupByProjection.columnNames.length,
      hasSideEffects: this._config.hasSideEffects,
      isAliased: false,
      isEmpty: this._config.isEmpty,
      isJoin: false,
      limit: this._config.limit,
      orderBy: [],
      projection,
      tableId: this._config.tableId,
      tableName: this._config.tableName,
      where: this._config.where,
    });
  }
}

class JoinImplementation<TColumns> implements JoinQueryBuilder<TColumns> {
  private readonly _config: QueryConfig<string, unknown, TColumns>;
  private readonly _rightWhere: readonly NonAggregatedValue<boolean>[];
  constructor(
    config: QueryConfig<string, unknown, TColumns>,
    rightWhere: readonly NonAggregatedValue<boolean>[],
  ) {
    this._config = config;
    this._rightWhere = rightWhere;
  }
  on(
    predicate: (column: TColumns) => NonAggregatedValue<boolean>,
  ): JoinQuery<TColumns> {
    const tableId = sql`${this._config.tableId} ON (${valueToSql(
      Operators.and(predicate(this._config.columns), ...this._rightWhere),
      {
        toValue: (v) => v,
        tableAlias: () => null,
        parentOperatorPrecedence: null,
      },
    )})`;
    return new SelectQueryImplementation<string, unknown, TColumns, TColumns>({
      columns: this._config.columns,
      distinct: this._config.distinct,
      distinctColumns: this._config.distinctColumns,
      groupBy: this._config.groupBy,
      hasSideEffects: this._config.hasSideEffects,
      isAliased: this._config.isAliased,
      isEmpty: this._config.isEmpty,
      isJoin: this._config.isJoin,
      limit: this._config.limit,
      orderBy: this._config.orderBy,
      projection: this._config.projection,
      tableId,
      tableName: this._config.tableName,
      where: this._config.where,
    });
  }
}

class StatementReturning<TRecord> implements SelectQuery<TRecord> {
  private readonly _table: TableSchema<TRecord>;
  private readonly _statement: SQLQuery | null;
  private readonly _projection: Projection | null;
  constructor(
    table: TableSchema<TRecord>,
    statement: SQLQuery | null,
    projection: Projection | null,
  ) {
    this._table = table;
    this._statement = statement;
    this._projection = projection;
  }

  private _query(): FinalQueryConfig {
    const selection = this._projection?.query ?? sql`*`;

    return {
      query: this._statement
        ? sql`${this._statement} RETURNING ${selection}`
        : sql`SELECT ${selection} WHERE FALSE`,
      isEmpty: !this._statement,
    };
  }

  toSql(): SQLQuery {
    const {query} = this._query();
    return query;
  }

  private _getQuery(): SelectQuery<TRecord> {
    const {query, isEmpty} = this._query();
    return new SelectQueryImplementation({
      columns: this._table.columns,
      distinct: false,
      distinctColumns: [],
      groupBy: 0,
      hasSideEffects: !isEmpty,
      isAliased: false,
      isEmpty,
      isJoin: false,
      limit: null,
      orderBy: [],
      projection: null,
      tableId: sql`(${query}) AS ${sql.ident(this._table.tableName)}`,
      tableName: this._table.tableName,
      where: [],
    });
  }
  as<TAliasTableName extends string>(
    alias: TAliasTableName,
  ): AliasedQuery<TAliasTableName, TRecord> {
    if (!/^[a-z][a-z0-9_]*$/.test(alias)) {
      throw new Error(
        `Table aliases must start with a lower case letter and only contain letters, numbers and underscores`,
      );
    }
    const aliasedColumns = aliasColumns(alias, this._table.columns);
    const {query, isEmpty} = this._query();
    return new SelectQueryImplementation({
      columns: aliasedColumns,
      distinct: false,
      distinctColumns: [],
      groupBy: 0,
      hasSideEffects: !isEmpty,
      isAliased: true,
      isEmpty,
      isJoin: false,
      limit: null,
      orderBy: [],
      projection: null,
      tableId: sql`(${query}) AS ${sql.ident(alias)}`,
      tableName: alias,
      where: [],
    });
  }

  where(condition: WhereCondition<TRecord>): SelectQuery<TRecord> {
    return this._getQuery().where(condition);
  }
  select<TSelection>(...selection: any[]): ProjectedQuery<TSelection> {
    return this._getQuery().select(...selection) as any;
  }
  selectAggregate<TAggregation>(
    aggregation: (
      column: Columns<TRecord>,
    ) => AggregatedSelectionSet<TAggregation>,
  ): AggregatedQuery<TAggregation> {
    return this._getQuery().selectAggregate(aggregation);
  }
  groupBy<TSelection>(
    ...selection: any[]
  ): GroupByQuery<TSelection, Columns<TRecord>> {
    return this._getQuery().groupBy(...selection);
  }
  orderByAscDistinct(
    columnName: keyof TRecord,
  ): ProjectedDistinctColumnsQuery<TRecord> {
    return this._getQuery().orderByAscDistinct(columnName);
  }
  orderByDescDistinct(
    columnName: keyof TRecord,
  ): ProjectedDistinctColumnsQuery<TRecord> {
    return this._getQuery().orderByDescDistinct(columnName);
  }
  orderByAsc(columnName: keyof TRecord): ProjectedSortedQuery<TRecord> {
    return this._getQuery().orderByAsc(columnName);
  }
  orderByDesc(columnName: keyof TRecord): ProjectedSortedQuery<TRecord> {
    return this._getQuery().orderByDesc(columnName);
  }
  distinct(): ProjectedDistinctQuery<TRecord> {
    return this._getQuery().distinct();
  }
  limit(n: number): ProjectedLimitQuery<TRecord> {
    return this._getQuery().limit(n);
  }

  one(): TypedDatabaseQuery<TRecord | undefined> {
    return new OneQuery(this._query());
  }

  oneRequired(): TypedDatabaseQuery<TRecord> {
    return new OneRequiredQuery(this._query());
  }

  first(): TypedDatabaseQuery<TRecord | undefined> {
    return new FirstQuery(this._query());
  }

  async executeQuery(database: Queryable): Promise<TRecord[]> {
    const {query, isEmpty} = this._query();
    if (isEmpty) return [];
    return await database.query(query);
  }
}

class AggregatedQueryImplementation<TRecord>
  implements AggregatedQuery<TRecord>
{
  private readonly _query: ProjectedLimitQuery<TRecord>;
  constructor(query: ProjectedLimitQuery<TRecord>) {
    this._query = query;
  }
  toSql(): SQLQuery {
    return this._query.toSql();
  }
  as<TAliasTableName extends string>(
    alias: TAliasTableName,
  ): AliasedQuery<TAliasTableName, TRecord> {
    return this._query.as(alias);
  }

  async executeQuery(database: Queryable): Promise<TRecord> {
    const results = await database.query(this._query.toSql());
    if (results.length !== 1) {
      throw new Error(
        `Expected exactly one row to be returned by this query because it is "aggregated"`,
      );
    }
    return results[0];
  }
}

function selectionSetSpecialToProjection<TSelection>(
  selection: SelectionSet<TSelection>,
): Projection {
  if (isSpecialValue(selection)) {
    switch (selection.__selectionSetType) {
      case 'STAR':
        return {
          query: sql`${sql.ident(selection.tableName)}.*`,
          columnNames: [`*`],
        };
      case 'MERGED': {
        const parts: SQLQuery[] = [];
        const columnNames = [];
        for (const part of selection.selections) {
          const projection = selectionSetSpecialToProjection(part);
          if (projection.columnNames.length) {
            parts.push(projection.query);
            columnNames.push(...projection.columnNames);
          }
        }
        return {query: sql.join(parts, `,`), columnNames};
      }
    }
  }
  return selectionSetToProjection(selection);
}

function selectionSetToProjection<TSelection>(
  selection:
    | SelectionSetObject<TSelection>
    | AggregatedSelectionSet<TSelection>,
): Projection {
  const entries = Object.entries(selection);
  return {
    query: sql.join(
      entries.map(([alias, value]) => valueToSelect(alias, value)),
      `,`,
    ),
    columnNames: entries.map(([alias]) => alias),
  };
}

function columnNamesToProjection(columnNames: readonly string[]): Projection {
  return {
    query: sql.join(
      columnNames.map((column) => {
        if (typeof column !== 'string') {
          throw new Error(`Expected column names to be strings.`);
        }
        return sql.ident(column);
      }),
      `,`,
    ),
    columnNames,
  };
}
