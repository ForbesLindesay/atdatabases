import {Schema, ClassKind} from '@databases/pg-schema-introspect';
import {DataTypeID} from '@databases/pg/src';
import PrintContext from '../PrintContext';
import printClassDetails from './printClassDetails';

export default function printSchema(type: Schema, context: PrintContext) {
  context.pushTypeDeclaration({type: 'schema'}, (identifier, {getImport}) => [
    `interface ${identifier} {`,
    ...type.classes
      .filter((cls) => cls.kind === ClassKind.OrdinaryTable)
      .map((cls) => {
        const {DatabaseRecord, InsertParameters} = printClassDetails(
          cls,
          context,
        );
        return `  ${cls.className}: {record: ${getImport(
          DatabaseRecord,
        )}, insert: ${getImport(InsertParameters)}};`;
      }),
    `}`,
  ]);
  context.pushValueDeclaration({type: 'serializeValue'}, (identifier) => {
    const tables = type.classes
      .filter((cls) => cls.kind === ClassKind.OrdinaryTable)
      .map((cls) => {
        const jsonAttributes = cls.attributes
          .filter(
            (a) =>
              a.typeID === DataTypeID.json || a.typeID === DataTypeID.jsonb,
          )
          .map((a) => a.attributeName);
        return {
          tableName: cls.className,
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
      ` * is a JSON or JSONB column.`,
      ` * This is necessary if you want to store values that are not plain objects`,
      ` * in a JSON or JSONB column.`,
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
