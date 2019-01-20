import {TypeRecord} from './getTypes';
import DefaultTypeScriptMapping from './DefaultTypeScriptMapping';

export default function getTypeScriptType(
  type: TypeRecord,
  typeMapping: {[key in number | string]?: string} = {},
): string {
  const _t: {[key in number | string]?: string} = {
    ...DefaultTypeScriptMapping,
    ...typeMapping,
  };
  return (
    _t[type.typeID] ||
    _t[`${type.schemaName}.${type.typeName}`] ||
    _t[`${type.typeName}`] ||
    'string'
  );
}
