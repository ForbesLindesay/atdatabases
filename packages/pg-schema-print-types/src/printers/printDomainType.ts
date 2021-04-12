import {PgTypesDomainTypeMode} from '@databases/pg-config';
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
    case PgTypesDomainTypeMode.strict_brand:
    case PgTypesDomainTypeMode.loose_brand:
    case PgTypesDomainTypeMode.alias:
      return file.getImport(
        context.pushTypeDeclaration(
          {type: 'domain', name: type.typeName},
          (identifierName, file) => [
            `type ${identifierName} = ${context.getTypeScriptType(
              type.basetypeID,
              file,
            )}${getBrand(type.typeName, context)};`,
          ],
        ),
      );
    case PgTypesDomainTypeMode.inline:
      return `${context.getTypeScriptType(type.basetypeID, file)}${getBrand(
        type.typeName,
        context,
      )};`;
  }
}

function getBrand(typeName: string, context: PrintContext): string {
  switch (context.options.domainTypeMode) {
    case PgTypesDomainTypeMode.strict_brand:
      return ` & {readonly __brand: '${typeName}'}`;
    case PgTypesDomainTypeMode.loose_brand:
      return ` & {readonly __brand?: '${typeName}'}`;
    case PgTypesDomainTypeMode.alias:
    case PgTypesDomainTypeMode.inline:
      return '';
  }
}
