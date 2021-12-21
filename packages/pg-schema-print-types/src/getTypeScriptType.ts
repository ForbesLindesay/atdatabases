import {Type, TypeKind} from '@databases/pg-schema-introspect';
import {FileContext} from '@databases/shared-print-types';
import PgPrintContext from './PgPrintContext';
import printArrayType from './printers/printArrayType';
import printDomainType from './printers/printDomainType';
import printEnumType from './printers/printEnumType';

export default function getTypeScriptType(
  type: Type,
  context: PgPrintContext,
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
