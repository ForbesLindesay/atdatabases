import Value, {AggregatedValue} from './SpecialValues';

export type SelectionSet<TSelection> = {
  [key in keyof TSelection]: Value<TSelection[key]>;
};

export type AggregatedSelectionSet<TSelection> = {
  [key in keyof TSelection]: AggregatedValue<TSelection[key]>;
};
