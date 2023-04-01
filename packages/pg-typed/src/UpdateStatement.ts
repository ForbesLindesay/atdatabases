/**
 * UpdateStatement should be returned by:
 *
 *   Table.bulkUpdate(...)
 *   Table.update(...)
 *
 * It will let you specify whether you want to return the updated rows or not,
 * and which columns you want to return.
 *
 * Alternative idea for bulk operations:
 *
 * Table.bulk<TInput>(inputs: TInput[]): Bulk<TRecord, TInsertParams, TInput>
 *
 * interface Bulk<TRecord, TInsertParams, TInput> {
 *   insert: (params: {[TColumn in keyof TInsertParams]: BulkInsertParam<TInsertParams[TColumn], TInput>}) => InsertStatement<TRecord>;
 *   update: (
 *     where: {[TColumn in keyof TRecord]: BulkQueryParam<TRecord[TColumn], TInput>},
 *     set: {[TColumn in keyof TRecord]: BulkUpdateParam<TRecord[TColumn], TInput>}
 *   ) => UpdateStatement<TRecord>;
 *   find: (where: {[TColumn in keyof TRecord]: BulkQueryParam<TRecord[TColumn], TInput>}) => FindStatement<TRecord>;
 *   delete: (where: {[TColumn in keyof TRecord]: BulkQueryParam<TRecord[TColumn], TInput>}) => DeleteStatement<TRecord>;
 * }
 */
