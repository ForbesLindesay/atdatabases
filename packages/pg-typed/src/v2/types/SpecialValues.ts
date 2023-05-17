import {SQLQuery} from '@databases/pg';

export type BooleanCombiner = 'AND' | 'OR';

export type RawValue<T> = T extends SQLQuery
  ? never
  : T extends {readonly __isSpecialValue: true}
  ? never
  : T;

export interface ValueToSqlContext {
  readonly tableAlias: (tableName: string) => string | null;
  readonly toValue: <T>(value: RawValue<T>) => unknown;
  readonly parentOperatorPrecedence: number | null;
}

export interface NonAggregatedTypedValue<T> {
  readonly __isSpecialValue: true;
  readonly __isNonAggregatedComputedValue: true;
  __getType(): T;
  toSql(ctx: ValueToSqlContext): SQLQuery;
}

export interface BaseAggregatedTypedValue<T> {
  readonly __isSpecialValue: true;
  readonly __isAggregatedValue: true;
  __getType(): T;
  toSql(ctx: ValueToSqlContext): SQLQuery;
}

export interface FieldConditionToSqlContext extends ValueToSqlContext {
  readonly left: SQLQuery;
}

export interface ComputedFieldCondition<T> {
  readonly __isSpecialValue: true;
  readonly __isFieldQuery: true;
  __getType(): T;
  getStaticValue(): boolean | null;
  toSqlCondition(ctx: FieldConditionToSqlContext): SQLQuery;
}

export interface AggregatedTypedValue<T> extends BaseAggregatedTypedValue<T> {
  distinct(): AggregatedTypedValue<T>;
  orderByAsc<TOrderBy>(value: Value<TOrderBy>): AggregatedTypedValue<T>;
  orderByDesc<TOrderBy>(value: Value<TOrderBy>): AggregatedTypedValue<T>;
  filter(condition: Value<boolean>): BaseAggregatedTypedValue<T>;
}

export interface AnyOf<T> extends ComputedFieldCondition<T> {
  readonly __isSpecialValue: true;
  readonly __isAnyOf: true;
  __getType(): T;
}

export type ComputedValue<T> = SQLQuery | NonAggregatedTypedValue<T>;
export type AggregatedValue<T> = SQLQuery | BaseAggregatedTypedValue<T>;

type Value<T> = RawValue<T> | ComputedValue<T>;
export default Value;

export function isSpecialValue(
  value: unknown,
): value is {readonly __isSpecialValue: true} {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__isSpecialValue' in value &&
    value.__isSpecialValue === true
  );
}
export function isComputedFieldQuery(value: unknown): value is {
  readonly __isSpecialValue: true;
  readonly __isFieldQuery: true;
} {
  return isSpecialValue(value) && (value as any).__isFieldQuery === true;
}
export function isNonAggregatedComputedValue(value: unknown): value is {
  readonly __isSpecialValue: true;
  readonly __isNonAggregatedComputedValue: true;
} {
  return (
    isSpecialValue(value) &&
    (value as any).__isNonAggregatedComputedValue === true
  );
}
export function isAnyOfCondition(value: unknown): value is {
  readonly __isSpecialValue: true;
  readonly __isAnyOf: true;
} {
  return isSpecialValue(value) && (value as any).__isAnyOf === true;
}

export type FieldCondition<T> = RawValue<T> | ComputedFieldCondition<T>;
