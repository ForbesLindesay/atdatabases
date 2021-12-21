import {ArrayType} from '@databases/pg-schema-introspect';
import {FileContext} from '@databases/shared-print-types';
import PgPrintContext from '../PgPrintContext';

export default function printArrayType(
  type: ArrayType,
  context: PgPrintContext,
  file: FileContext,
): string {
  return `Array<${context.getTypeScriptType(type.subtypeID, file)}>`;
}
