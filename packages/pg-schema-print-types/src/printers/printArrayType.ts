import {ArrayType} from '@databases/pg-schema-introspect';
import PrintContext, {FileContext} from '../PrintContext';

export default function printArrayType(
  type: ArrayType,
  context: PrintContext,
  file: FileContext,
): string {
  return `Array<${context.getTypeScriptType(type.subtypeID, file)}>`;
}
