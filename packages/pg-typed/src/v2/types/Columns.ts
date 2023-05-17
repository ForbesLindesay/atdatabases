import {SQLQuery} from '@databases/pg';
import {NonAggregatedTypedValue} from './SpecialValues';

export interface ColumnReference<T> extends NonAggregatedTypedValue<T> {
  readonly postgresTypeQuery?: SQLQuery;
  readonly postgresType?: string;
  setAlias(tableAlias: string): ColumnReference<T>;
}

export type Columns<TRecord> = {
  [TColumnName in keyof TRecord]: ColumnReference<TRecord[TColumnName]>;
};

export type JoinedColumns<
  TLeftTables,
  TRightAlias extends string,
  TRightRecordColumns,
> = {
  [TChildAlias in
    | keyof TLeftTables
    | TRightAlias]: TChildAlias extends keyof TLeftTables
    ? TLeftTables[TChildAlias]
    : TRightRecordColumns;
};

export type InnerJoinedColumns<
  TLeftTables,
  TRightAlias extends string,
  TRightRecord,
> = JoinedColumns<TLeftTables, TRightAlias, Columns<TRightRecord>>;

export type LeftOuterJoinedColumns<
  TLeftTables,
  TRightAlias extends string,
  TRightRecord,
> = JoinedColumns<
  TLeftTables,
  TRightAlias,
  Columns<{
    [TColumnName in keyof TRightRecord]: TRightRecord[TColumnName] | null;
  }>
>;
