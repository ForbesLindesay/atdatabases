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
      return file.getImport(
        context.pushValueDeclaration(
          {type: 'enum', name: type.typeName},
          (identifierName) => [
            `enum ${identifierName} {`,
            ...type.values.map((value) => `  ${value} = '${value}',`),
            `}`,
          ],
        ),
      );
    case 'union_alias':
      return file.getImport(
        context.pushTypeDeclaration(
          {type: 'enum', name: type.typeName},
          (identifierName) => [`type ${identifierName} = ${getUnion(type)};`],
        ),
      );
    case 'union_alias_with_object':
      return file.getImport(
        context.pushValueDeclaration(
          {type: 'enum', name: type.typeName},
          (identifierName) => [
            `type ${identifierName} = ${getUnion(type)};`,
            `const ${identifierName} = {`,
            ...type.values.map((value) => `  ${value}: '${value}',`),
            `} as const;`,
          ],
        ),
      );
    case 'inline':
      return getUnion(type);
  }
}

function getUnion(type: EnumType): string {
  return type.values.map((v) => `'${v}'`).join(' | ');
}
