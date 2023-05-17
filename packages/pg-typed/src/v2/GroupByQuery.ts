import {ProjectedSortedQuery} from './types/Queries';
import {AggregatedSelectionSet} from './types/SelectionSet';

export default interface GroupByQuery<TSelection, TColumns> {
  selectAggregate<TAggregation>(
    aggregation: (column: TColumns) => AggregatedSelectionSet<TAggregation>,
  ): ProjectedSortedQuery<TSelection & TAggregation>;
}
