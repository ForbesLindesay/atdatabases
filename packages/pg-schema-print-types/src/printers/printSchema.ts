import {Schema, ClassKind} from '@databases/pg-schema-introspect';
import PgDataTypeID from '@databases/pg-data-type-id';
import PgPrintContext from '../PgPrintContext';
import printClassDetails from './printClassDetails';

export default function printSchema(schema: Schema, context: PgPrintContext) {
  context.printer.pushTypeDeclaration(
    {type: 'schema'},
    (identifier, {getImport}) => [
      `interface ${identifier} {`,
      ...schema.classes
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
    ],
  );

  context.printer.pushValueDeclaration(
    {type: 'serializeValue'},
    (identifier) => {
      const tables = schema.classes
        .filter((cls) => cls.kind === ClassKind.OrdinaryTable)
        .map((cls) => {
          const jsonAttributes = cls.attributes
            .filter(
              (a) =>
                a.typeID === PgDataTypeID.json ||
                a.typeID === PgDataTypeID.jsonb,
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
    },
  );

  const typeAliases = new Map([
    [`INT2`, `SMALLINT`],
    [`INT4`, `INTEGER`],
    [`INT8`, `BIGINT`],
  ]);
  const types = new Map(
    [
      ...Object.entries(PgDataTypeID)
        .map(([typeName, typeId]) =>
          typeof typeId === 'number' ? ([typeId, typeName] as const) : null,
        )
        .filter(<T>(v: T): v is Exclude<T, null> => v !== null),
      ...schema.types.map((t) => [t.typeID, t.typeName] as const),
    ]
      .map(
        ([typeId, typeName]) =>
          [typeId, typeName.toUpperCase().replace(/^_(.*)$/, `$1[]`)] as const,
      )
      .map(([typeId, typeName]) => [
        typeId,
        typeName.endsWith(`[]`)
          ? `${
              typeAliases.get(
                typeName.substring(0, typeName.length - `[]`.length),
              ) ?? typeName.substring(0, typeName.length - `[]`.length)
            }[]`
          : typeAliases.get(typeName) ?? typeName,
      ]),
  );

  const schemaJsonFileName = context.options.getSchemaJsonFileName();

  if (schemaJsonFileName) {
    const schemaJson = schema.classes
      .filter((cls) => cls.kind === ClassKind.OrdinaryTable)
      .map((table) => ({
        name: table.className,
        columns: table.attributes.map((column) => {
          const typeName = types.get(column.typeID) ?? null;
          return {
            name: column.attributeName,
            isNullable: !column.notNull,
            hasDefault: column.hasDefault,
            typeId: column.typeID,
            typeName: typeName,
          };
        }),
      }));
    context.printer.writeFile(
      schemaJsonFileName,
      JSON.stringify(schemaJson, null, `  `) + `\n`,
    );
  }
}
