import {DataType, Schema, TableType} from '@databases/mysql-schema-introspect';
import {PrintContext} from '@databases/shared-print-types';
import MySqlPrintOptions from '../MySqlPrintOptions';
import TypeID from '../TypeID';
import printTableDetails from './printTableDetails';

export default function printSchema(
  type: Schema,
  context: PrintContext<TypeID>,
  options: MySqlPrintOptions,
) {
  context.pushTypeDeclaration({type: 'schema'}, (identifier, {getImport}) => [
    `interface ${identifier} {`,
    ...type.tables
      .filter((table) => table.tableType === TableType.BaseTable)
      .map((table) => {
        const {DatabaseRecord, InsertParameters} = printTableDetails(
          table,
          context,
          options,
        );
        return `  ${table.tableName}: {record: ${getImport(
          DatabaseRecord,
        )}, insert: ${getImport(InsertParameters)}};`;
      }),
    `}`,
  ]);
  context.pushValueDeclaration({type: 'serializeValue'}, (identifier) => {
    const tables = type.tables
      .filter((table) => table.tableType === TableType.BaseTable)
      .map((table) => {
        const jsonAttributes = table.columns
          .filter((c) => c.type.kind === DataType.json)
          .map((c) => c.columnName);
        return {
          tableName: table.tableName,
          jsonAttributes,
        };
      })
      .filter((table) => table.jsonAttributes.length > 0);
    if (!tables.length) {
      return [
        `function ${identifier}(_tableName: string, _columnName: string, value: unknown): unknown {`,
        `  return value;`,
        `}`,
      ];
    }
    const columnCondition = (columns: string[]) =>
      columns.length === 0
        ? `false`
        : columns.length === 1
        ? `c === ${JSON.stringify(columns[0])}`
        : `(${columns
            .map((columnName) => `c === ${JSON.stringify(columnName)}`)
            .join(' || ')})`;
    const tableConditions = tables.map(
      ({tableName, jsonAttributes}) =>
        `t === ${JSON.stringify(tableName)} && ${columnCondition(
          jsonAttributes,
        )}`,
    );
    return [
      `/**`,
      ` * JSON serialize values (v) if the table name (t) and column name (c)`,
      ` * is a JSON column.`,
      ` * This is necessary if you want to store values that are not plain objects`,
      ` * in a JSON column.`,
      ` */`,
      `function ${identifier}(t: string, c: string, v: unknown): unknown {`,
      `  if (${
        tableConditions.length === 1
          ? tableConditions[0]
          : `\n    ${tableConditions
              .map((c) => `(${c})`)
              .join(' ||\n    ')}\n  `
      }) {`,
      `    return JSON.stringify(v);`,
      `  }`,
      `  return v;`,
      `}`,
    ];
  });
}
