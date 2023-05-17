import Value, {
  AggregatedTypedValue,
  FieldCondition,
  RawValue,
  AnyOf,
} from './SpecialValues';

export interface List<T> {
  [Symbol.iterator](): IterableIterator<T>;
}

// prettier-ignore
export interface IOperators {
  allOf<T>(values: List<FieldCondition<T>>): FieldCondition<T>;
  and(...values: Value<boolean>[]): Value<boolean>;
  anyOf<T>(values: Value<List<FieldCondition<T>>>): AnyOf<T>;
  caseInsensitive: (value: FieldCondition<string>) => FieldCondition<string>;
  count<T>(expression?: Value<T>): AggregatedTypedValue<number>;
  eq<T>(left: Value<T>, right: Value<T> | AnyOf<T>): Value<boolean>;
  gt<T>(right: RawValue<T>): FieldCondition<T>;
  gt<T>(left: Value<T>, right: Value<T>): Value<boolean>;
  gte<T>(right: RawValue<T>): FieldCondition<T>;
  gte<T>(left: Value<T>, right: Value<T>): Value<boolean>;
  neq<T>(left: Value<T>, right: Value<T>): Value<boolean>;
  ilike(right: string): FieldCondition<string>;
  ilike(left: Value<string>, right: Value<string>): Value<boolean>;
  // TODO: IN should probably have an SQL query as the right hand side
  // in<T>(left: Value<T>, right: Value<T[]>): Value<boolean>;
  like(right: string): FieldCondition<string>;
  like(left: Value<string>, right: Value<string>): Value<boolean>;
  lower(value: Value<string>): Value<string>;
  lt<T>(right: RawValue<T>): FieldCondition<T>;
  lt<T>(left: Value<T>, right: Value<T>): Value<boolean>;
  lte<T>(right: RawValue<T>): FieldCondition<T>;
  lte<T>(left: Value<T>, right: Value<T>): Value<boolean>;
  max<T>(value: Value<T>): AggregatedTypedValue<T>;
  min<T>(value: Value<T>): AggregatedTypedValue<T>;
  not(value: Value<boolean>): Value<boolean>;
  not<T>(value: FieldCondition<T>): FieldCondition<T>;
  or(...values: Value<boolean>[]): Value<boolean>;
  sum<T extends BigInt | number>(value: Value<T>): AggregatedTypedValue<T>;
}
