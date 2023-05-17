import AliasedQuery from './AliasedQuery';
import {Columns} from './types/Columns';
import {ProjectedQuery} from './types/Queries';
import GroupByQuery from './GroupByQuery';
import InsertQuery from './InsertQuery';
import SelectQuery, {WhereCondition, selectQuery} from './SelectQuery';
import {AggregatedSelectionSet, SelectionSet} from './types/SelectionSet';
import TableSchema from './TableSchema';
import {TypedDatabaseQuery} from './types/TypedDatabaseQuery';

export interface Table<TRecord, TInsertParameters = TRecord>
  extends SelectQuery<TRecord> {
  insert(...records: TInsertParameters[]): InsertQuery<TRecord>;
}

class TableImplementation<TRecord, TInsertParameters>
  implements Table<TRecord, TInsertParameters>
{
  private _table: TableSchema<TRecord>;
  constructor(table: TableSchema<TRecord>) {
    this._table = table;
  }

  as<TAliasTableName extends string>(
    alias: TAliasTableName,
  ): AliasedQuery<{[TKey in TAliasTableName]: TRecord}> {
    return selectQuery(this._table).as<TAliasTableName>(alias);
  }

  where(condition: WhereCondition<TRecord>): SelectQuery<TRecord> {
    return selectQuery(this._table).where(condition);
  }

  select<TColumnNames extends (keyof TRecord)[]>(
    ...columnNames: TColumnNames
  ): ProjectedQuery<Pick<TRecord, TColumnNames[number]>>;
  select<TSelection>(
    selection: (column: Columns<TRecord>) => SelectionSet<TSelection>,
  ): ProjectedQuery<TSelection>;
  select(...args: any): any {
    return selectQuery(this._table).select(...args);
  }

  groupBy<TColumnNames extends (keyof TRecord)[]>(
    ...columnNames: TColumnNames
  ): GroupByQuery<Pick<TRecord, TColumnNames[number]>, TRecord>;
  groupBy<TSelection>(
    selection: (column: Columns<TRecord>) => SelectionSet<TSelection>,
  ): GroupByQuery<TSelection, TRecord>;
  groupBy(...args: any): any {
    return selectQuery(this._table).groupBy(...args);
  }

  selectAggregate<TAggregation>(
    aggregation: (
      column: Columns<TRecord>,
    ) => AggregatedSelectionSet<TAggregation>,
  ): TypedDatabaseQuery<TAggregation> {
    return selectQuery(this._table).selectAggregate(aggregation);
  }
}
