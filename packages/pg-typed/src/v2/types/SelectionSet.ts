import {AggregatedValue, NonAggregatedValue} from './SpecialValues';

export type SelectionSetStar<TSelection> = {
  readonly __isSpecialValue: true;
  readonly __selectionSetType: 'STAR';
  readonly tableName: string;
  __getType(): TSelection;
};

export type SelectionSetMerged<TSelection> = {
  readonly __isSpecialValue: true;
  readonly __selectionSetType: 'MERGED';
  readonly selections: SelectionSet<Partial<TSelection>>[];
  __getType(): TSelection;
};

export type SelectionSetObject<TSelection> = {
  [key in keyof TSelection]: key extends '__isSpecialValue'
    ? never
    : NonAggregatedValue<TSelection[key]>;
};

export type SelectionSet<TSelection> =
  | SelectionSetStar<TSelection>
  | SelectionSetMerged<TSelection>
  | SelectionSetObject<TSelection>;

export type AggregatedSelectionSet<TSelection> = {
  [key in keyof TSelection]: AggregatedValue<TSelection[key]>;
};
