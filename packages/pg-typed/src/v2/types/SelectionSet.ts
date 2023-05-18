import {AggregatedValue, NonAggregatedValue} from './SpecialValues';

export type SelectionSet<TSelection> = {
  [key in keyof TSelection]: NonAggregatedValue<TSelection[key]>;
};

export type AggregatedSelectionSet<TSelection> = {
  [key in keyof TSelection]: AggregatedValue<TSelection[key]>;
};
