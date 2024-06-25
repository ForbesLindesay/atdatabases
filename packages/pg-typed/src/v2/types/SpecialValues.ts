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

export interface SpecialTypedValue<T> {
  readonly __isSpecialValue: true;
  __getType(): T;
  readonly sqlType: string | null | undefined;
  toSql(ctx: ValueToSqlContext): SQLQuery;
}

export interface NonAggregatedTypedValue<T> extends SpecialTypedValue<T> {
  readonly __isNonAggregatedComputedValue: true;
}

export interface BaseAggregatedTypedValue<T> extends SpecialTypedValue<T> {
  readonly __isAggregatedValue: true;
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
  orderByAsc<TOrderBy>(
    value: NonAggregatedValue<TOrderBy>,
  ): AggregatedTypedValue<T>;
  orderByDesc<TOrderBy>(
    value: NonAggregatedValue<TOrderBy>,
  ): AggregatedTypedValue<T>;
  filter(condition: NonAggregatedValue<boolean>): BaseAggregatedTypedValue<T>;
}

export interface AnyOf<T> extends ComputedFieldCondition<T> {
  readonly __isSpecialValue: true;
  readonly __isAnyOf: true;
  __getType(): T;
}

export type AggregatedValue<T> =
  | RawValue<T>
  | SQLQuery
  | BaseAggregatedTypedValue<T>;

export type NonAggregatedValue<T> =
  | RawValue<T>
  | SQLQuery
  | NonAggregatedTypedValue<T>;

export interface TypedValue<T>
  extends BaseAggregatedTypedValue<T>,
    NonAggregatedTypedValue<T> {}
export type Value<T> = RawValue<T> | SQLQuery | TypedValue<T>;
export type UnknownValue<T> =
  | RawValue<T>
  | SQLQuery
  | BaseAggregatedTypedValue<T>
  | NonAggregatedTypedValue<T>;

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
