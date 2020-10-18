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
    case 'enum':
    case 'union_alias':
    case 'union_alias_with_object':
      return file.getImport(
        context.pushDeclaration(
          {type: 'enum', name: type.typeName},
          (identifierName) => {
            const results: string[] = [];
            if (context.options.enumTypeMode === 'enum') {
              results.push(
                `enum ${identifierName} {`,
                ...type.values.map((value) => `  ${value} = '${value}',`),
                `}`,
              );
            } else {
              results.push(`type ${identifierName} = ${getUnion(type)};`);
              if (context.options.enumTypeMode === 'union_alias_with_object') {
                results.push(
                  `const ${identifierName} = {`,
                  ...type.values.map((value) => `  ${value}: '${value}',`),
                  `} as const;`,
                );
              }
            }
            return results;
          },
        ),
      );
    case 'inline':
      return getUnion(type);
  }
}

function getUnion(type: EnumType): string {
  return type.values.map((v) => `'${v}'`).join(' | ');
}
