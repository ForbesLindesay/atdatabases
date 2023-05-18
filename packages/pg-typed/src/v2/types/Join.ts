import GroupByQuery from '../GroupByQuery';
import {JoinableQueryLeft} from './JoinableQuery';
import {ProjectedQuery} from './Queries';
import {AggregatedSelectionSet, SelectionSet} from './SelectionSet';
import {NonAggregatedValue} from './SpecialValues';

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
    selection: (column: TColumns) => SelectionSet<TSelection>,
  ): GroupByQuery<TSelection, TColumns>;
  selectAggregate<TAggregation>(
    aggregation: (column: TColumns) => AggregatedSelectionSet<TAggregation>,
  ): ProjectedQuery<TAggregation>;

  where(
    predicate: (column: TColumns) => NonAggregatedValue<boolean>,
  ): JoinQuery<TColumns>;
}
