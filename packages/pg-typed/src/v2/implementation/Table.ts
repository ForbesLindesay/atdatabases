import {SQLQuery, sql} from '@databases/pg';
import TableSchema from '../types/TableSchema';
import Table from '../types/Table';
import {
  AggregatedQuery,
  AliasedQuery,
  GroupByQuery,
  ProjectedDistinctColumnsQuery,
  ProjectedDistinctQuery,
  ProjectedLimitQuery,
  ProjectedQuery,
  ProjectedSortedQuery,
  SelectQuery,
} from '../types/Queries';
import createQuery from './Queries';
import WhereCondition from '../types/WhereCondition';
import {ColumnReference, Columns} from '../types/Columns';
import {
  AggregatedSelectionSet,
  SelectionSetObject,
} from '../types/SelectionSet';
import {
  DeleteStatement,
  InsertStatement,
  UpdateStatement,
} from '../types/Statements';
import {TypedDatabaseQuery, Queryable} from '../types/TypedDatabaseQuery';
import {
  createDeleteStatement,
  createInsertStatement,
  createUpdateStatement,
} from './Statements';

class TableImplementation<TRecord, TInsertParameters>
  implements Table<TRecord, TInsertParameters>
{
  private readonly _table: TableSchema<TRecord>;
  private readonly _query: SelectQuery<TRecord>;
  constructor(table: TableSchema<TRecord>) {
    this._table = table;
    this._query = createQuery(table);
  }

  insert(...records: TInsertParameters[]): InsertStatement<TRecord> {
    if (records.length === 0) return createInsertStatement(this._table, null);

    const columnNamesSet = new Set<keyof TRecord & keyof TInsertParameters>();
    for (const record of records) {
      for (const columnName of Object.keys(record as any)) {
        columnNamesSet.add(
          columnName as keyof TRecord & keyof TInsertParameters,
        );
      }
    }
    const columnNames = [...columnNamesSet].sort();

    const columnNamesSql = sql.join(
      columnNames.map((columnName) => sql.ident(columnName)),
      `,`,
    );

    const values = records.map(
      (record) =>
        sql`(${sql.join(
          columnNames.map((columnName): SQLQuery => {
            const column = this._table.columns[
              columnName
            ] as ColumnReference<unknown>;
            const value: any = record[columnName];
            if (!column) {
              throw new Error(`Unexpected column: ${columnName as string}`);
            }
            if (value === undefined) {
              return sql`DEFAULT`;
            } else {
              return sql.value(column.serializeValue(value));
            }
          }),
          `,`,
        )})`,
    );

    return createInsertStatement(
      this._table,
      sql`INSERT INTO ${
        this._table.tableId
      } (${columnNamesSql}) VALUES ${sql.join(values, `,`)}`,
    );
  }

  update(
    condition: WhereCondition<TRecord>,
    updateValues:
      | Partial<TRecord>
      | ((column: Columns<TRecord>) => Partial<SelectionSetObject<TRecord>>),
  ): UpdateStatement<TRecord> {
    return createUpdateStatement(
      this._table,
      condition,
      typeof updateValues === 'function'
        ? updateValues(this._table.columns)
        : (updateValues as Partial<SelectionSetObject<TRecord>>),
    );
  }

  delete(condition: WhereCondition<TRecord>): DeleteStatement<TRecord> {
    return createDeleteStatement(this._table, condition);
  }

  // == Methods of SelectQuery<TRecord> ==

  toSql(): SQLQuery {
    return this._query.toSql();
  }
  as<TAliasTableName extends string>(
    alias: TAliasTableName,
  ): AliasedQuery<TAliasTableName, TRecord> {
    return this._query.as(alias);
  }
  where(condition: WhereCondition<TRecord>): SelectQuery<TRecord> {
    return this._query.where(condition);
  }
  select<TSelection>(...selection: any[]): ProjectedQuery<TSelection> {
    return this._query.select(...selection) as any;
  }
  selectAggregate<TAggregation>(
    aggregation: (
      column: Columns<TRecord>,
    ) => AggregatedSelectionSet<TAggregation>,
  ): AggregatedQuery<TAggregation> {
    return this._query.selectAggregate(aggregation);
  }
  groupBy<TSelection>(
    ...selection: any[]
  ): GroupByQuery<TSelection, Columns<TRecord>> {
    return this._query.groupBy(...selection);
  }
  orderByAscDistinct(
    columnName: keyof TRecord,
  ): ProjectedDistinctColumnsQuery<TRecord> {
    return this._query.orderByAscDistinct(columnName);
  }
  orderByDescDistinct(
    columnName: keyof TRecord,
  ): ProjectedDistinctColumnsQuery<TRecord> {
    return this._query.orderByDescDistinct(columnName);
  }
  orderByAsc(columnName: keyof TRecord): ProjectedSortedQuery<TRecord> {
    return this._query.orderByAsc(columnName);
  }
  orderByDesc(columnName: keyof TRecord): ProjectedSortedQuery<TRecord> {
    return this._query.orderByDesc(columnName);
  }
  distinct(): ProjectedDistinctQuery<TRecord> {
    return this._query.distinct();
  }
  limit(n: number): ProjectedLimitQuery<TRecord> {
    return this._query.limit(n);
  }

  private _whereOptional(
    whereCondition?: WhereCondition<TRecord>,
  ): SelectQuery<TRecord> {
    return whereCondition ? this._query.where(whereCondition) : this._query;
  }
  one(
    whereCondition?: WhereCondition<TRecord>,
  ): TypedDatabaseQuery<TRecord | undefined> {
    return this._whereOptional(whereCondition).one();
  }

  oneRequired(
    whereCondition?: WhereCondition<TRecord>,
  ): TypedDatabaseQuery<TRecord> {
    return this._whereOptional(whereCondition).oneRequired();
  }

  first(
    whereCondition?: WhereCondition<TRecord>,
  ): TypedDatabaseQuery<TRecord | undefined> {
    return this._whereOptional(whereCondition).first();
  }

  async executeQuery(database: Queryable): Promise<TRecord[]> {
    return this._query.executeQuery(database);
  }
}

export default function createTableApi<TRecord, TInsertParameters = TRecord>(
  tableName: string,
  tableId: SQLQuery,
  columns: Columns<TRecord>,
): Table<TRecord, TInsertParameters> {
  return new TableImplementation<TRecord, TInsertParameters>({
    columns,
    tableId,
    tableName,
  });
}
