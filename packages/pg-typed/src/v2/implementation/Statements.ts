import {SQLQuery, sql} from '@databases/pg';
import {
  BaseStatement,
  InsertStatement,
  InsertStatementOnConflictBuilder,
  StatementCount,
  UpdateStatement,
} from '../types/Statements';
import {Queryable} from '../types/TypedDatabaseQuery';
import TableSchema from '../types/TableSchema';
import {ColumnReference, Columns} from '../types/Columns';
import {SelectionSetObject} from '../types/SelectionSet';
import {valueToSql} from './Operators';
import {SelectQuery} from '../types/Queries';
import {createStatementReturn} from './Queries';

interface AnyStatement<TRecord>
  extends InsertStatementOnConflictBuilder<TRecord>,
    InsertStatement<TRecord>,
    UpdateStatement<TRecord> {}

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
  returning(star: '*'): SelectQuery<TRecord>;
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
          )
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

export default function createInsertStatement<TRecord>(
  table: TableSchema<TRecord>,
  statement: SQLQuery | null,
): InsertStatement<TRecord> {
  return new StatementImplementation<TRecord>(table, statement);
}

function selectionSetToUpdate<TRecord>(
  columns: Columns<TRecord>,
  ...selections: Partial<SelectionSetObject<TRecord>>[]
): SQLQuery {
  const entries = selections.flatMap((selection) => Object.entries(selection));
  return sql.join(
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
  );
}
