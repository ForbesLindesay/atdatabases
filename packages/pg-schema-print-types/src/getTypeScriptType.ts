import {Type, TypeKind} from '@databases/pg-schema-introspect';
import PrintContext, {FileContext} from './PrintContext';
import printArrayType from './printers/printArrayType';
import printDomainType from './printers/printDomainType';
import printEnumType from './printers/printEnumType';

export default function getTypeScriptType(
  type: Type,
  context: PrintContext,
  file: FileContext,
): string {
  switch (type.kind) {
    case TypeKind.Array:
      return printArrayType(type, context, file);
    case TypeKind.Domain:
      return printDomainType(type, context, file);
    case TypeKind.Enum:
      return printEnumType(type, context, file);
  }

  return 'string';
}
