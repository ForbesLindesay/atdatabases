import {ColumnType, DataType} from '@databases/mysql-schema-introspect';
import DefaultTypeScriptMapping from '../DefaultTypeScriptMapping';
import MySqlPrintOptions from '../MySqlPrintOptions';

export default function getTypeScriptType(
  type: ColumnType,
  options: MySqlPrintOptions,
): string {
  const override = options.typeOverrides[type.kind];
  if (override !== undefined) {
    return override;
  }

  const builtin = DefaultTypeScriptMapping.get(type.kind);
  if (builtin) return builtin;

  if (type.kind === DataType.enum) {
    return `(${type.values.map((v) => JSON.stringify(v)).join(` | `)})`;
  }
  if (type.kind === DataType.set) {
    return `(${type.values.map((v) => JSON.stringify(v)).join(` | `)})[]`;
  }

  return `unknown`;
}
