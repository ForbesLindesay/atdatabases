import {EnumType} from '@databases/pg-schema-introspect';
import PrintContext, {FileContext} from '../PrintContext';

export enum EnumTypeMode {
  EnumType,
  UnionAlias,
  UnionAliasWithObject,
  Inline,
}
export default function printEnumType(
  type: EnumType,
  context: PrintContext,
  file: FileContext,
): string {
  switch (context.options.enumTypeMode) {
    case EnumTypeMode.EnumType:
    case EnumTypeMode.UnionAlias:
    case EnumTypeMode.UnionAliasWithObject:
      return file.getImport(
        context.pushDeclaration(
          {type: 'enum', name: type.typeName},
          type.typeName,
          ({isDefaultExport}) => {
            const results: string[] = [];
            const namedExportKeyword = isDefaultExport ? `` : `export `;
            if (context.options.enumTypeMode === EnumTypeMode.EnumType) {
              results.push(`${namedExportKeyword}enum ${type.typeName} {`);
              for (const value of type.values) {
                results.push(`  ${value} = '${value}',`);
              }
              results.push(`}`);
            } else {
              results.push(
                `${namedExportKeyword}type ${type.typeName} = ${getUnion(
                  type,
                )};`,
              );
              if (
                context.options.enumTypeMode ===
                EnumTypeMode.UnionAliasWithObject
              ) {
                results.push(`${namedExportKeyword}const ${type.typeName} = {`);
                for (const value of type.values) {
                  results.push(`  ${value} = '${value}',`);
                }
                results.push(`} as const;`);
              }
            }
            if (isDefaultExport) {
              results.push(`export default ${type.typeName}`);
            }
            return results;
          },
        ),
      );
    case EnumTypeMode.Inline:
      return getUnion(type);
  }
}

function getUnion(type: EnumType): string {
  return type.values.map((v) => `'${v}'`).join(' | ');
}
