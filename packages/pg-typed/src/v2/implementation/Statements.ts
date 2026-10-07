import {SQLQuery, sql} from '@databases/pg';
import {
  BaseStatement,
  DeleteStatement,
  InsertStatement,
  InsertStatementOnConflictBuilder,
  StatementCount,
  UpdateStatement,
} from '../types/Statements';
import {Queryable, TypedDatabaseQuery} from '../types/TypedDatabaseQuery';
import TableSchema from '../types/TableSchema';
import {ColumnReference, Columns} from '../types/Columns';
import {SelectionSetObject} from '../types/SelectionSet';
import Operators, {valueToSql} from './Operators';
import {SelectQuery} from '../types/Queries';
import {createStatementReturn, whereConditionToPredicates} from './Queries';
import WhereCondition from '../types/WhereCondition';

interface AnyStatement<TRecord>
  extends InsertStatementOnConflictBuilder<TRecord>,
    InsertStatement<TRecord>,
    UpdateStatement<TRecord>,
    DeleteStatement<TRecord> {}

class StatementImplementation<TRecord> implements AnyStatement<TRecord> {
  private readonly _table: TableSchema<TRecord>;
  private readonly _statement: SQLQuery | null;
  constructor(table: TableSchema<TRecord>, statement: SQLQuery | null) {
    this._table = table;
    this._statement = statement;
  }

  returningCount(): StatementCount {
    return new StatementCountImplementation(this._statement);
  }

  returning(): SelectQuery<TRecord>;
  returning<TColumnNames extends (keyof TRecord)[]>(
    ...columnNames: TColumnNames
  ): SelectQuery<Pick<TRecord, TColumnNames[number]>>;
  returning<TSelection>(
    selection: (column: Columns<TRecord>) => SelectionSetObject<TSelection>,
  ): SelectQuery<TSelection>;
  returning<TSelection>(...selection: any[]): SelectQuery<TSelection> {
    return createStatementReturn<TRecord, TSelection>(
      this._table,
      this._statement,
      selection,
    );
  }

  returningOne(): TypedDatabaseQuery<TRecord | undefined>;
  returningOne<TColumnNames extends (keyof TRecord)[]>(
    ...columnNames: TColumnNames
  ): TypedDatabaseQuery<Pick<TRecord, TColumnNames[number]> | undefined>;
  returningOne<TSelection>(
    selection: (column: Columns<TRecord>) => SelectionSetObject<TSelection>,
  ): TypedDatabaseQuery<TSelection | undefined>;
  returningOne<TSelection>(
    ...selection: any[]
  ): TypedDatabaseQuery<TSelection | undefined> {
    return createStatementReturn<TRecord, TSelection>(
      this._table,
      this._statement,
      selection,
    ).one();
  }

  returningOneRequired(): TypedDatabaseQuery<TRecord>;
  returningOneRequired<TColumnNames extends (keyof TRecord)[]>(
    ...columnNames: TColumnNames
  ): TypedDatabaseQuery<Pick<TRecord, TColumnNames[number]>>;
  returningOneRequired<TSelection>(
    selection: (column: Columns<TRecord>) => SelectionSetObject<TSelection>,
  ): TypedDatabaseQuery<TSelection>;
  returningOneRequired<TSelection>(
    ...selection: any[]
  ): TypedDatabaseQuery<TSelection> {
    return createStatementReturn<TRecord, TSelection>(
      this._table,
      this._statement,
      selection,
    ).oneRequired();
  }

  doUpdate(...columns: (keyof TRecord)[]): BaseStatement<TRecord>;
  doUpdate(
    updates: (
      columns: Columns<TRecord>,
      excluded: Columns<TRecord>,
    ) => Partial<SelectionSetObject<TRecord>>,
  ): BaseStatement<TRecord>;
  doUpdate(...updates: any[]): BaseStatement<TRecord> {
    if (this._statement === null) return this;
    const updatesSql =
      typeof updates[0] === 'function'
        ? selectionSetToUpdate(
            this._table.columns,
            updates[0](
              this._table.columns,
              // TODO: make these references to EXCLUDED.column_name not table.column_name
              this._table.columns,
            ),
          ).query
        : sql.join(
            (updates as string[]).map(
              (key) => sql`${sql.ident(key)}=EXCLUDED.${sql.ident(key)}`,
            ),
            sql`, `,
          );
    return new StatementImplementation<TRecord>(
      this._table,
      sql`${this._statement} DO UPDATE SET ${updatesSql}`,
    );
  }

  onConflict(
    ...columns: readonly (keyof TRecord)[]
  ): InsertStatementOnConflictBuilder<TRecord> {
    if (this._statement === null) return this;
    return new StatementImplementation<TRecord>(
      this._table,
      sql`${this._statement} ON CONFLICT (${sql.join(
        columns.map((columnName) => sql.ident(columnName)),
        `,`,
      )})`,
    );
  }

  onConflictDoNothing(): BaseStatement<TRecord> {
    if (this._statement === null) return this;
    return new StatementImplementation<TRecord>(
      this._table,
      sql`${this._statement} ON CONFLICT DO NOTHING`,
    );
  }

  toSql(): SQLQuery | null {
    return this._statement;
  }

  async executeQuery(database: Queryable): Promise<void> {
    if (this._statement) {
      await database.query(this._statement);
    }
  }
}

class StatementCountImplementation<TRecord> implements StatementCount {
  private readonly _statement: SQLQuery | null;
  constructor(statement: SQLQuery | null) {
    this._statement = statement;
  }

  toSql(): SQLQuery {
    return this._statement
      ? sql`${this._statement} RETURNING (COUNT(*))::INT AS row_count`
      : sql`SELECT 0 AS row_count`;
  }

  async executeQuery(database: Queryable): Promise<number> {
    if (!this._statement) return 0;
    const results = await database.query(
      sql`${this._statement} RETURNING (COUNT(*))::INT AS row_count`,
    );
    return results.length ? results[0].row_count : 0;
  }
}

export function createInsertStatement<TRecord>(
  table: TableSchema<TRecord>,
  statement: SQLQuery | null,
): InsertStatement<TRecord> {
  return new StatementImplementation<TRecord>(table, statement);
}

export function createUpdateStatement<TRecord>(
  table: TableSchema<TRecord>,
  condition: WhereCondition<TRecord>,
  updateValues: Partial<SelectionSetObject<TRecord>>,
): UpdateStatement<TRecord> {
  const predicate = Operators.and(
    ...whereConditionToPredicates(table.columns, condition),
  );
  const {query: update, columnCount} = selectionSetToUpdate(
    table.columns,
    updateValues,
  );

  return new StatementImplementation<TRecord>(
    table,
    predicate === false || columnCount === 0
      ? null
      : sql`UPDATE ${table.tableId} SET ${update} WHERE ${valueToSql(
          predicate,
          {
            parentOperatorPrecedence: null,
            toValue: (v) => v,
            tableAlias: () => null,
          },
        )}`,
  );
}

export function createDeleteStatement<TRecord>(
  table: TableSchema<TRecord>,
  condition: WhereCondition<TRecord>,
): DeleteStatement<TRecord> {
  const predicate = Operators.and(
    ...whereConditionToPredicates(table.columns, condition),
  );

  return new StatementImplementation<TRecord>(
    table,
    predicate === false
      ? null
      : sql`DELETE FROM ${table.tableId} WHERE ${valueToSql(predicate, {
          parentOperatorPrecedence: null,
          toValue: (v) => v,
          tableAlias: () => null,
        })}`,
  );
}

function selectionSetToUpdate<TRecord>(
  columns: Columns<TRecord>,
  selection: Partial<SelectionSetObject<TRecord>>,
): {query: SQLQuery; columnCount: number} {
  const entries = Object.entries(selection).filter(
    ([, value]) => value !== undefined,
  );
  return {
    query: sql.join(
      entries.map(([columnName, value]) => {
        const column = columns[
          columnName as keyof TRecord
        ] as ColumnReference<unknown>;
        return sql`${sql.ident(columnName)}=${valueToSql(value, {
          parentOperatorPrecedence: null,
          toValue: (v) => column.serializeValue(v as any),
          tableAlias: () => null,
        })}`;
      }),
      `,`,
    ),
    columnCount: entries.length,
  };
}
