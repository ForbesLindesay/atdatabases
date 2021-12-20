import {MySqlTypesPrimaryKeyTypeMode} from '@databases/mysql-config/lib/MySqlConfig';
import {
  Column,
  TableDetails,
  TableType,
} from '@databases/mysql-schema-introspect';
import {FileContext, PrintContext} from '@databases/shared-print-types';
import assertNever from 'assert-never';
import MySqlPrintOptions from '../MySqlPrintOptions';
import TypeID from '../TypeID';
import getTypeScriptType from './getTypeScriptType';

export default function printTableDetails(
  type: TableDetails,
  context: PrintContext<TypeID>,
  options: MySqlPrintOptions,
) {
  if (type.tableType !== TableType.BaseTable) {
    throw new Error(
      'printTableDetails only supports base tables at the moment.',
    );
  }
  const DatabaseRecord = context.pushTypeDeclaration(
    {type: 'table', name: type.tableName},
    (identifierName, file) => [
      ...getClassComment(type),
      `interface ${identifierName} {`,
      ...type.columns
        .map((column) => [
          ...getColumnComment(column),
          `  ${column.columnName}: ${getColumnType(
            type,
            column,
            context,
            file,
            options,
          )}`,
        ])
        .reduce((a, b) => [...a, ...b], []),
      `}`,
    ],
  );
  const InsertParameters = context.pushTypeDeclaration(
    {type: 'insert_parameters', name: type.tableName},
    (identifierName, file) => [
      ...getClassComment(type),
      `interface ${identifierName} {`,
      ...type.columns
        .map((column) => [
          ...getColumnComment(column),
          `  ${column.columnName}${optionalOnInsert(column)}: ${getColumnType(
            type,
            column,
            context,
            file,
            options,
          )}`,
        ])
        .reduce((a, b) => [...a, ...b], []),
      `}`,
    ],
  );
  return {DatabaseRecord, InsertParameters};
}

function getClassComment(table: TableDetails): string[] {
  const commentLines = [];
  if (table.comment.trim()) {
    commentLines.push(...table.comment.trim().split('\n'));
  }
  if (commentLines.length) {
    return [`/**`, ...commentLines.map((l) => ` * ${l}`), ` */`];
  } else {
    return [];
  }
}
function getColumnComment(column: Column): string[] {
  const commentLines = [];
  if (column.comment.trim()) {
    commentLines.push(...column.comment.trim().split('\n'));
  }
  if (column.default) {
    if (commentLines.length) commentLines.push(``);
    commentLines.push(`@default ${column.default}`);
  }
  if (commentLines.length) {
    return [`  /**`, ...commentLines.map((l) => `   * ${l}`), `   */`];
  } else {
    return [];
  }
}

function getColumnType(
  type: TableDetails,
  column: Column,
  context: PrintContext<TypeID>,
  file: FileContext,
  options: MySqlPrintOptions,
): string {
  // Handle nullable columns
  if (column.isNullable) {
    return `(${getColumnType(
      type,
      {...column, isNullable: false},
      context,
      file,
      options,
    )}) | null`;
  }

  // Handle column level overrides
  const columnTypeOverride =
    options.columnTypeOverrides[
      `${column.schemaName}.${column.tableName}.${column.columnName}`
    ] ||
    options.columnTypeOverrides[`${column.tableName}.${column.columnName}`];
  if (columnTypeOverride) {
    return columnTypeOverride;
  }

  // Handle foreign keys
  const columnConstraints = type.constraints.filter((constraint) =>
    constraint.columns.some((c) => c.columnName === column.columnName),
  );
  for (const constraint of columnConstraints) {
    const referencedColumn = constraint.columns.find(
      (c) => c.columnName === column.columnName && c.referenced !== null,
    )?.referenced;
    const referencedTable = referencedColumn
      ? options.getTable({
          schemaName: referencedColumn.schemaName,
          tableName: referencedColumn.tableName,
        })
      : null;
    if (referencedTable && referencedColumn) {
      const {DatabaseRecord} = printTableDetails(
        referencedTable,
        context,
        options,
      );
      return `${file.getImport(DatabaseRecord)}['${
        referencedColumn.columnName
      }']`;
    }
  }

  // Handle primary keys
  if (column.isPrimaryKey) {
    return handleBrand(column, context, file, options);
  }

  return getTypeScriptType(column.type, options);
}

function optionalOnInsert(column: Column): string {
  if (column.isNullable) return '?';
  if (column.default !== null) return '?';
  return '';
}

function handleBrand(
  column: Column,
  context: PrintContext<TypeID>,
  file: FileContext,
  options: MySqlPrintOptions,
): string {
  const typeStr = `${getTypeScriptType(column.type, options)}${getBrand(
    column,
    options,
  )}`;
  switch (options.primaryKeyTypeMode) {
    case MySqlTypesPrimaryKeyTypeMode.strict_brand:
    case MySqlTypesPrimaryKeyTypeMode.loose_brand:
      return file.getImport(
        context.pushTypeDeclaration(
          {
            type: 'primary_key',
            name: column.tableName,
            columnName: column.columnName,
          },
          (identifierName) => [`type ${identifierName} = ${typeStr}`],
        ),
      );
    case MySqlTypesPrimaryKeyTypeMode.inline_loose_brand:
    case MySqlTypesPrimaryKeyTypeMode.inline_strict_brand:
    case MySqlTypesPrimaryKeyTypeMode.inline_no_brand:
      return typeStr;
    default:
      return assertNever(options.primaryKeyTypeMode);
  }
}

function getBrand(column: Column, options: MySqlPrintOptions): string {
  switch (options.primaryKeyTypeMode) {
    case MySqlTypesPrimaryKeyTypeMode.inline_loose_brand:
    case MySqlTypesPrimaryKeyTypeMode.loose_brand:
      return ` & {readonly __brand?: '${column.tableName}_${column.columnName}'}`;
    case MySqlTypesPrimaryKeyTypeMode.inline_strict_brand:
    case MySqlTypesPrimaryKeyTypeMode.strict_brand:
      return ` & {readonly __brand: '${column.tableName}_${column.columnName}'}`;
    case MySqlTypesPrimaryKeyTypeMode.inline_no_brand:
      return '';
    default:
      return assertNever(options.primaryKeyTypeMode);
  }
}
