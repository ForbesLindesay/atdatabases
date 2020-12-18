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
    return [
      `function ${identifier}(tableName: string, columnName: string, value: unknown): unknown {`,
      `  switch (tableName) {`,
      ...tables.map(({tableName, jsonAttributes}) =>
        [
          `    case ${JSON.stringify(tableName)}:`,
          `      switch (columnName) {`,
          ...jsonAttributes.map(
            (columnName) => `        case ${JSON.stringify(columnName)}:`,
          ),
          `          return JSON.stringify(value);`,
          `        default:`,
          `          return value;`,
          `      }`,
        ].join('\n'),
      ),
      `    default:`,
      `      return value;`,
      `  }`,
      `}`,
    ];
  });
}
