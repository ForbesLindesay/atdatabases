import {Columns} from './Columns';
import {JoinQueryBuilder} from './Join';
import ProjectedLimitQuery from '../ProjectedLimitQuery';

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

export interface JoinableQueryLeft<TLeftTables> {
  innerJoin<TRightAlias extends string, TRightRecord>(
    otherQuery: JoinableQueryRight<TRightAlias, TRightRecord>,
  ): JoinQueryBuilder<
    InnerJoinedColumns<TLeftTables, TRightAlias, TRightRecord>
  >;
  leftOuterJoin<TRightAlias extends string, TRightRecord>(
    otherQuery: JoinableQueryRight<TRightAlias, TRightRecord>,
  ): JoinQueryBuilder<
    LeftOuterJoinedColumns<TLeftTables, TRightAlias, TRightRecord>
  >;
}

export interface JoinableQueryRight<TAlias extends string, TRightRecord>
  extends ProjectedLimitQuery<TRightRecord> {
  alias: TAlias;
}
