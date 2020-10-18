import {DomainType} from '@databases/pg-schema-introspect';
import PrintContext, {FileContext} from '../PrintContext';

export enum DomainTypeMode {
  StrictBrand,
  LooseBrand,
  Alias,
  Inline,
}
export default function printDomainType(
  type: DomainType,
  context: PrintContext,
  file: FileContext,
): string {
  switch (context.options.domainTypeMode) {
    case 'strict_brand':
    case 'loose_brand':
    case 'alias':
      return file.getImport(
        context.pushDeclaration(
          {type: 'domain', name: type.typeName},
          (identifierName, file) => [
            `type ${identifierName} = ${context.getTypeScriptType(
              type.basetypeID,
              file,
            )}${getBrand(type.typeName, context)};`,
          ],
        ),
      );
    case 'inline':
      return `${context.getTypeScriptType(type.basetypeID, file)}${getBrand(
        type.typeName,
        context,
      )};`;
  }
}

function getBrand(typeName: string, context: PrintContext): string {
  switch (context.options.domainTypeMode) {
    case 'strict_brand':
      return ` & {readonly __brand: '${typeName}'}`;
    case 'loose_brand':
      return ` & {readonly __brand?: '${typeName}'}`;
    case 'alias':
    case 'inline':
      return '';
  }
}
