/**
 * FindStatement should be returned by:
 *
 *   Table.bulkFind(...)
 *   Table.find(...)
 *   Table.findOne(...)
 *   Table.findOneRequired(...)
 */

import type {SQLQuery} from '@databases/pg';
import {ExecutableStatement} from './ExecutableStatement';
import {UpdateParameters, WhereCondition} from './Utilities';

export type UnorderedFindStatementMethods =
  | 'toSql'
  | 'one'
  | 'oneRequired'
  | 'all'
  | 'select'
  | 'distinct'
  | 'orderByAscDistinct'
  | 'orderByDescDistinct'
  | 'orderByAsc'
  | 'orderByDesc'
  | 'andWhere'
  | 'then'
  | 'catch'
  | 'finally'
  | 'execute';

export type FindStatementMethods =
  | UnorderedFindStatementMethods
  | 'first'
  | 'limit';

export interface FindStatement<TRecord, TMethods extends FindStatementMethods>
  extends ExecutableStatement<TRecord[]> {
  toSql(): SQLQuery;

  one(): Promise<TRecord | null>;
  oneRequired(): Promise<TRecord>;
  all(): Promise<TRecord[]>;
  first(): Promise<TRecord | null>;
  limit(count: number): Promise<TRecord[]>;

  update(
    setColumns: UpdateParameters<TRecord>,
  ): UpdateStatement<TRecord, UpdateStatementMethods>;
  delete(): DeleteStatement<TRecord, DeleteStatementMethods>;

  andWhere(condition: WhereCondition<TRecord>): this;

  select<
    TKeys extends readonly [keyof TRecord, ...(readonly (keyof TRecord)[])],
  >(
    ...fields: TKeys
  ): PartialFindStatement<
    Pick<TRecord, TKeys[number]>,
    Exclude<TMethods, 'select' | 'update' | 'delete'>
  >;
  distinct(
    ...columns: readonly (keyof TRecord)[]
  ): PartialFindStatement<
    TRecord,
    Exclude<
      TMethods,
      | 'distinct'
      | 'orderByAscDistinct'
      | 'orderByDescDistinct'
      | 'orderByAsc'
      | 'orderByDesc'
      | 'update'
      | 'delete'
    >
  >;
  orderByAscDistinct(
    key: keyof TRecord,
  ): PartialFindStatement<
    TRecord,
    Exclude<TMethods, 'distinct' | 'update' | 'delete'> | 'first' | 'limit'
  >;
  orderByDescDistinct(
    key: keyof TRecord,
  ): PartialFindStatement<
    TRecord,
    Exclude<TMethods, 'distinct' | 'update' | 'delete'> | 'first' | 'limit'
  >;
  orderByAsc(
    key: keyof TRecord,
  ): PartialFindStatement<
    TRecord,
    | Exclude<
        TMethods,
        | 'distinct'
        | 'orderByAscDistinct'
        | 'orderByDescDistinct'
        | 'update'
        | 'delete'
      >
    | 'first'
    | 'limit'
  >;
  orderByDesc(
    key: keyof TRecord,
  ): PartialFindStatement<
    TRecord,
    | Exclude<
        TMethods,
        | 'distinct'
        | 'orderByAscDistinct'
        | 'orderByDescDistinct'
        | 'update'
        | 'delete'
      >
    | 'first'
    | 'limit'
  >;
}
export type PartialFindStatement<
  TRecord,
  TMethods extends FindStatementMethods,
> = Pick<FindStatement<TRecord, TMethods>, TMethods>;

export type UnorderedFindStatement<TRecord> = PartialFindStatement<
  TRecord,
  UnorderedFindStatementMethods
>;

export type UpdateStatementMethods =
  | 'toSql'
  | 'execute'
  | 'then'
  | 'catch'
  | 'finally';

export interface UpdateStatement<
  TRecord,
  TMethods extends UpdateStatementMethods,
> extends ExecutableStatement<void> {}

export type DeleteStatementMethods =
  | 'toSql'
  | 'execute'
  | 'then'
  | 'catch'
  | 'finally';

export interface DeleteStatement<
  TRecord,
  TMethods extends DeleteStatementMethods,
> extends ExecutableStatement<void> {}
