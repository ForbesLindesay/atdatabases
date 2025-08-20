import {NonAggregatedValue, FieldCondition} from './SpecialValues';
import {Columns} from './Columns';

export type WhereConditionObject<TRecord> = {
  readonly [key in keyof TRecord]?: FieldCondition<TRecord[key]>;
};

export type WhereConditionFunction<TColumns> = (
  c: TColumns,
) => NonAggregatedValue<boolean>;

type WhereCondition<TRecord, TColumns = Columns<TRecord>> =
  | NonAggregatedValue<boolean>
  | WhereConditionObject<TRecord>
  | WhereConditionFunction<TColumns>;
export default WhereCondition;
