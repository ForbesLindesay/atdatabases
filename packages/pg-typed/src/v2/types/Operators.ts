import WhereCondition from '../WhereCondition';
import {
  AggregatedTypedValue,
  NonAggregatedValue,
  FieldCondition,
  RawValue,
  AnyOf,
  AggregatedValue,
  Value,
} from './SpecialValues';

export interface List<T> {
  [Symbol.iterator](): IterableIterator<T>;
}

export interface NonAggregatedJsonValue<TValue> {
  readonly __isSpecialValue: true;
  asString(): NonAggregatedValue<string>;
  asJson(): NonAggregatedValue<TValue>;
  prop<TKey extends keyof TValue>(
    key: TKey,
  ): NonAggregatedJsonValue<TValue[TKey]>;
}

export interface AggregatedJsonValue<TValue> {
  readonly __isSpecialValue: true;
  asString(): AggregatedValue<string>;
  asJson(): AggregatedValue<TValue>;
  prop<TKey extends keyof TValue>(key: TKey): AggregatedJsonValue<TValue[TKey]>;
}

// prettier-ignore
export interface IOperators {
  allOf<T>(values: List<FieldCondition<T>>): FieldCondition<T>;
  and(...values: Value<boolean>[]): Value<boolean>;
  and(...values: NonAggregatedValue<boolean>[]): NonAggregatedValue<boolean>;
  and(...values: AggregatedValue<boolean>[]): AggregatedValue<boolean>;
  and<TRecord>(...conditions: WhereCondition<TRecord>[]): WhereCondition<TRecord>;
  anyOf<T>(values: NonAggregatedValue<List<FieldCondition<T>>>): AnyOf<T>;
  caseInsensitive: (value: FieldCondition<string>) => FieldCondition<string>;
  count<T>(expression?: NonAggregatedValue<T>): AggregatedTypedValue<number>;
  eq<T>(left: Value<T>, right: Value<T>): Value<boolean>;
  eq<T>(left: NonAggregatedValue<T>, right: NonAggregatedValue<T> | AnyOf<T>): NonAggregatedValue<boolean>;
  eq<T>(left: AggregatedValue<T>, right: AggregatedValue<T>): AggregatedValue<boolean>;
  gt<T>(right: RawValue<T>): FieldCondition<T>;
  gt<T>(left: Value<T>, right: Value<T>): Value<boolean>;
  gt<T>(left: NonAggregatedValue<T>, right: NonAggregatedValue<T>): NonAggregatedValue<boolean>;
  gt<T>(left: AggregatedValue<T>, right: AggregatedValue<T>): AggregatedValue<boolean>;
  gte<T>(right: RawValue<T>): FieldCondition<T>;
  gte<T>(left: Value<T>, right: Value<T>): Value<boolean>;
  gte<T>(left: NonAggregatedValue<T>, right: NonAggregatedValue<T>): NonAggregatedValue<boolean>;
  gte<T>(left: AggregatedValue<T>, right: AggregatedValue<T>): AggregatedValue<boolean>;
  neq<T>(left: Value<T>, right: Value<T>): Value<boolean>;
  neq<T>(left: NonAggregatedValue<T>, right: NonAggregatedValue<T>): NonAggregatedValue<boolean>;
  neq<T>(left: AggregatedValue<T>, right: AggregatedValue<T>): AggregatedValue<boolean>;
  ilike(right: string): FieldCondition<string>;
  ilike(left: NonAggregatedValue<string>, right: NonAggregatedValue<string>): NonAggregatedValue<boolean>;
  // TODO: IN should probably have an SQL query as the right hand side
  // in<T>(left: Value<T>, right: Value<T[]>): Value<boolean>;
  json<T>(value: NonAggregatedValue<T>): NonAggregatedJsonValue<T>;
  json<T>(value: AggregatedValue<T>): AggregatedJsonValue<T>;
  like(right: string): FieldCondition<string>;
  like(left: NonAggregatedValue<string>, right: NonAggregatedValue<string>): NonAggregatedValue<boolean>;
  lower(value: Value<string>): Value<string>;
  lower(value: NonAggregatedValue<string>): NonAggregatedValue<string>;
  lower(value: AggregatedValue<string>): AggregatedValue<string>;
  lt<T>(right: RawValue<T>): FieldCondition<T>;
  lt<T>(left: Value<T>, right: Value<T>): Value<boolean>;
  lt<T>(left: NonAggregatedValue<T>, right: NonAggregatedValue<T>): NonAggregatedValue<boolean>;
  lt<T>(left: AggregatedValue<T>, right: AggregatedValue<T>): AggregatedValue<boolean>;
  lte<T>(right: RawValue<T>): FieldCondition<T>;
  lte<T>(left: Value<T>, right: Value<T>): Value<boolean>;
  lte<T>(left: NonAggregatedValue<T>, right: NonAggregatedValue<T>): NonAggregatedValue<boolean>;
  lte<T>(left: AggregatedValue<T>, right: AggregatedValue<T>): AggregatedValue<boolean>;
  max<T>(value: NonAggregatedValue<T>): AggregatedTypedValue<T>;
  min<T>(value: NonAggregatedValue<T>): AggregatedTypedValue<T>;
  not(value: boolean): boolean;
  not(value: Value<boolean>): Value<boolean>;
  not(value: NonAggregatedValue<boolean>): NonAggregatedValue<boolean>;
  not(value: AggregatedValue<boolean>): AggregatedValue<boolean>;
  not<T>(value: FieldCondition<T>): FieldCondition<T>;
  or(...values: Value<boolean>[]): Value<boolean>;
  or(...values: NonAggregatedValue<boolean>[]): NonAggregatedValue<boolean>;
  or(...values: AggregatedValue<boolean>[]): AggregatedValue<boolean>;
  or<TRecord>(...conditions: WhereCondition<TRecord>[]): WhereCondition<TRecord>;
  sum<T extends BigInt | number>(value: NonAggregatedValue<T>): AggregatedTypedValue<T>;
  upper(value: Value<string>): Value<string>;
  upper(value: NonAggregatedValue<string>): NonAggregatedValue<string>;
  upper(value: AggregatedValue<string>): AggregatedValue<string>;
}
