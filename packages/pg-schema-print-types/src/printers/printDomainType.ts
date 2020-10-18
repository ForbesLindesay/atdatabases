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
    case DomainTypeMode.StrictBrand:
    case DomainTypeMode.LooseBrand:
    case DomainTypeMode.Alias:
      return file.getImport(
        context.pushDeclaration(
          {type: 'domain', name: type.typeName},
          type.typeName,
          (file) => [
            `${file.isDefaultExport ? `` : `export `}type ${
              type.typeName
            } = ${context.getTypeScriptType(type.basetypeID, file)}${getBrand(
              type.typeName,
              context.options.domainTypeMode,
            )};`,
            ...(file.isDefaultExport
              ? [`export default ${type.typeName};`]
              : []),
          ],
        ),
      );
    case DomainTypeMode.Inline:
      return context.getTypeScriptType(type.basetypeID, file);
  }
}

function getBrand(typeName: string, mode: DomainTypeMode): string {
  switch (mode) {
    case DomainTypeMode.StrictBrand:
      return ` & {readonly __brand: '${typeName}'}`;
    case DomainTypeMode.LooseBrand:
      return ` & {readonly __brand?: '${typeName}'}`;
    case DomainTypeMode.Alias:
    case DomainTypeMode.Inline:
      return '';
  }
}
