import {SQLQuery} from '@databases/pg';
import Value, {FieldCondition} from './types/SpecialValues';
import {Columns} from './types/Columns';

// TODO: this was for doing AND/OR with the simplified API - not sure if we should/can still support this
export interface WhereCombinedCondition<TRecord> {
  readonly __isSpecialValue: true;
  readonly __isWhereCombinedCondition: true;
  readonly conditions: readonly WhereConditionObject<TRecord>[];
  readonly combiner: 'AND' | 'OR';
}

export type WhereConditionObject<TRecord> =
  | Partial<{
      readonly [key in keyof TRecord]:
        | TRecord[key]
        | FieldCondition<TRecord[key]>;
    }>
  | WhereCombinedCondition<TRecord>
  | SQLQuery;

export type WhereConditionFunction<TColumns> = (c: TColumns) => Value<boolean>;

type WhereCondition<TRecord, TColumns = Columns<TRecord>> =
  | WhereConditionObject<TRecord>
  | WhereConditionFunction<TColumns>;
export default WhereCondition;
