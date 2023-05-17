import {Columns} from './types/Columns';
import {ProjectedQuery} from './types/Queries';
import GroupByQuery from './GroupByQuery';
import WhereCondition from './WhereCondition';
import {AggregatedSelectionSet, SelectionSet} from './types/SelectionSet';

export default interface SelectQuery<TRecord> extends ProjectedQuery<TRecord> {
  where(condition: WhereCondition<TRecord, Columns<TRecord>>): this;

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
    selection: (column: Columns<TRecord>) => SelectionSet<TSelection>,
  ): GroupByQuery<TSelection, Columns<TRecord>>;

  selectAggregate<TAggregation>(
    aggregation: (
      column: Columns<TRecord>,
    ) => AggregatedSelectionSet<TAggregation>,
  ): ProjectedQuery<TAggregation>;
}
