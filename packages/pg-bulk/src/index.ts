import {sql, SQLQuery} from '@databases/pg';

export interface ConstantOperationValue {
  readonly getValue?: undefined;
  readonly value: unknown;
  readonly type?: undefined;
}
export interface DynamicOperationValue<TOperation> {
  readonly getValue: (
    operation: TOperation,
    index: number,
    operations: readonly TOperation[],
  ) => unknown;
  readonly value?: undefined;
  readonly type: SQLQuery;
}
export type BulkOperationValue<TOperation> =
  | ConstantOperationValue
  | DynamicOperationValue<TOperation>;

function prepareColumns<TOperation>(
  columns: Record<string, BulkOperationValue<TOperation>>,
): readonly [
  readonly [SQLQuery, unknown][],
  readonly [SQLQuery, DynamicOperationValue<TOperation>][],
] {
  const constantColumns: [SQLQuery, unknown][] = [];
  const dynamicColumns: [SQLQuery, DynamicOperationValue<TOperation>][] = [];
  for (const [columnName, value] of Object.entries(columns)) {
    if (value.getValue) {
      dynamicColumns.push([sql.ident(columnName), value]);
    } else {
      constantColumns.push([sql.ident(columnName), value.value]);
    }
  }
  return [constantColumns, dynamicColumns] as const;
}

export interface BulkInsertOptions<TOperation> {
  readonly table: SQLQuery;
  readonly columns: Record<string, BulkOperationValue<TOperation>>;
  readonly operations: readonly TOperation[];
}

export function bulkInsertStatement<TOperation>(
  options: BulkInsertOptions<TOperation>,
) {
  const {table, columns, operations} = options;

  const [constantColumns, dynamicColumns] = prepareColumns(columns);

  // TODO: handle cases where all columns are constant

  return sql`INSERT INTO ${table} (${sql.join(
    [...constantColumns, ...dynamicColumns].map(([c]) => c),
    `,`,
  )}) SELECT ${sql.join(
    constantColumns.map(([, value]) => sql`${value}`),
    `,`,
  )},* FROM UNNEST(${sql.join(
    dynamicColumns.map(
      ([, {getValue, type}]) => sql`${operations.map(getValue)}::${type}[]`,
    ),
    `,`,
  )})`;
}

export interface BulkUpdateOptions<TOperation> {
  readonly table: SQLQuery;
  readonly setColumns: Record<string, BulkOperationValue<TOperation>>;
  readonly whereColumns: Record<string, BulkOperationValue<TOperation>>;
  readonly operations: readonly TOperation[];
}
export function bulkUpdateStatement<TOperation>(
  options: BulkUpdateOptions<TOperation>,
) {
  const {table, whereColumns, setColumns, operations} = options;
  const [constantSetColumns, dynamicSetColumns] = prepareColumns(setColumns);
  const [constantWhereColumns, dynamicWhereColumns] =
    prepareColumns(whereColumns);

  if (dynamicSetColumns.length === 0 && dynamicWhereColumns.length === 0) {
    if (constantWhereColumns.length === 0) {
      return sql`UPDATE ${table} SET ${sql.join(
        constantSetColumns.map(([c, v]) => sql`${c} = ${v}`),
        `,`,
      )}`;
    }
    return sql`UPDATE ${table} SET ${sql.join(
      constantSetColumns.map(([c, v]) => sql`${c} = ${v}`),
      `,`,
    )} WHERE ${sql.join(
      constantWhereColumns.map(([c, v]) => sql`${c} = ${v}`),
      ` AND `,
    )}`;
  }
  if (dynamicWhereColumns.length === 0) {
    throw new Error(
      `You cannot have dynamic set columns but no dynamic where columns in a bulk update.`,
    );
  }

  return sql`UPDATE ${table} SET ${sql.join(
    [
      ...constantSetColumns.map(([c, v]) => sql`${c} = ${v}`),
      ...dynamicSetColumns.map(
        ([c], i) => sql`${c} = bulk_query.${sql.ident(`set_${i}`)}`,
      ),
    ],
    `,`,
  )} FROM UNNEST(${sql.join(
    [...dynamicSetColumns, ...dynamicWhereColumns].map(
      ([, {getValue, type}]) => sql`${operations.map(getValue)}::${type}[]`,
    ),
    `,`,
  )}) AS bulk_query(${sql.join(
    [
      ...dynamicSetColumns.map((_, i) => sql.ident(`set_${i}`)),
      ...dynamicWhereColumns.map((_, i) => sql.ident(`where_${i}`)),
    ],
    `,`,
  )}) WHERE ${sql.join(
    [
      ...constantWhereColumns.map(([c, v]) => sql`${c} = ${v}`),
      ...dynamicWhereColumns.map(
        ([c], i) => sql`${c} = bulk_query.${sql.ident(`where_${i}`)}`,
      ),
    ],
    ` AND `,
  )}`;
}

export interface BulkWhereConditionOptions<TOperation> {
  readonly table?: SQLQuery;
  readonly whereColumns: Record<string, BulkOperationValue<TOperation>>;
  readonly operations: readonly TOperation[];
}
export function bulkWhereCondition<TOperation>(
  options: BulkWhereConditionOptions<TOperation>,
) {
  const {table, whereColumns: columns, operations} = options;
  const [constantColumns, dynamicColumns] = prepareColumns(columns);
  const conditions: SQLQuery[] = constantColumns.map(([c, v]) =>
    table ? sql`${table}.${c} = ${v}` : sql`${c} = ${v}`,
  );
  if (dynamicColumns.length !== 0) {
    const columns = sql.join(
      dynamicColumns.map(([columnName]) =>
        table ? sql`${table}.${columnName}` : columnName,
      ),
      `,`,
    );
    const unnestExpression = sql`SELECT * FROM UNNEST(${sql.join(
      dynamicColumns.map(
        ([, {getValue, type}]) => sql`${operations.map(getValue)}::${type}[]`,
      ),
      `,`,
    )})`;
    const condition = sql`(${columns}) IN (${unnestExpression})`;
    conditions.push(condition);
  }
  return sql.join(conditions, ` AND `);
}

export interface BulkDeleteOptions<TOperation>
  extends BulkWhereConditionOptions<TOperation> {
  readonly table: SQLQuery;
}
export function bulkDeleteStatement<TOperation>(
  options: BulkDeleteOptions<TOperation>,
) {
  const {table, whereColumns, operations} = options;
  const condition = bulkWhereCondition({
    whereColumns,
    operations,
  });
  return sql`DELETE FROM ${table} WHERE ${condition}`;
}
