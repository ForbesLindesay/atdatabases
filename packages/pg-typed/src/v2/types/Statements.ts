import {SQLQuery} from '@databases/pg';
import {TypedDatabaseQuery} from './TypedDatabaseQuery';
import {SelectionSetObject} from './SelectionSet';
import {Columns} from './Columns';
import {SelectQuery} from './Queries';

export interface StatementCount extends TypedDatabaseQuery<number> {
  toSql(): SQLQuery;
}
export interface BaseStatement<TRecord> extends TypedDatabaseQuery<void> {
  /**
   * Get the SQL query that would be executed. This is useful if you want to use this query as a sub-query in a query that is not type safe.
   *
   * Returns "null" if the query has no side effects (e.g. an insert with no records to insert)
   */
  toSql(): SQLQuery | null;

  returningCount(): StatementCount;

  returning(): SelectQuery<TRecord>;
  returning<TColumnNames extends (keyof TRecord)[]>(
    ...columnNames: TColumnNames
  ): SelectQuery<Pick<TRecord, TColumnNames[number]>>;
  returning<TSelection>(
    selection: (column: Columns<TRecord>) => SelectionSetObject<TSelection>,
  ): SelectQuery<TSelection>;

  returningOne(): TypedDatabaseQuery<TRecord | undefined>;
  returningOne<TColumnNames extends (keyof TRecord)[]>(
    ...columnNames: TColumnNames
  ): TypedDatabaseQuery<Pick<TRecord, TColumnNames[number]> | undefined>;
  returningOne<TSelection>(
    selection: (column: Columns<TRecord>) => SelectionSetObject<TSelection>,
  ): TypedDatabaseQuery<TSelection | undefined>;

  returningOneRequired(): TypedDatabaseQuery<TRecord>;
  returningOneRequired<TColumnNames extends (keyof TRecord)[]>(
    ...columnNames: TColumnNames
  ): TypedDatabaseQuery<Pick<TRecord, TColumnNames[number]>>;
  returningOneRequired<TSelection>(
    selection: (column: Columns<TRecord>) => SelectionSetObject<TSelection>,
  ): TypedDatabaseQuery<TSelection>;
}

export interface InsertStatementOnConflictBuilder<TRecord> {
  doUpdate(...columns: (keyof TRecord)[]): BaseStatement<TRecord>;
  doUpdate(
    updates: (
      columns: Columns<TRecord>,
      excluded: Columns<TRecord>,
    ) => Partial<SelectionSetObject<TRecord>>,
  ): BaseStatement<TRecord>;
}
export interface InsertStatement<TRecord> extends BaseStatement<TRecord> {
  onConflict(
    ...columns: readonly (keyof TRecord)[]
  ): InsertStatementOnConflictBuilder<TRecord>;
  onConflictDoNothing(): BaseStatement<TRecord>;
}

export interface UpdateStatement<TRecord> extends BaseStatement<TRecord> {}
export interface DeleteStatement<TRecord> extends BaseStatement<TRecord> {}
