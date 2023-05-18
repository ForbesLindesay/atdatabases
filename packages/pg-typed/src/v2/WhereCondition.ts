import {NonAggregatedValue, FieldCondition} from './types/SpecialValues';
import {Columns} from './types/Columns';

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
