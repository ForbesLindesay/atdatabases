import PgConfig from '@databases/pg-config';
import PgDataTypeID from '@databases/pg-data-type-id';
import type {Schema} from '@databases/pg-schema-introspect';
import PrintContext from './PrintContext';
import getTypeScriptType from './getTypeScriptType';
import PrintOptions from './PrintOptions';
import printSchemaInner from './printers/printSchema';
import writeFiles from './writeFiles';

export {PgDataTypeID};
export type Options = Omit<Partial<PgConfig['types']>, 'directory'>;

export function printSchema(schema: Schema, options: Options = {}) {
  const printContext = new PrintContext(
    getTypeScriptType,
    schema,
    new PrintOptions(options),
  );
  printSchemaInner(schema, printContext);
  return printContext.getFiles();
}
export async function writeSchema(
  schema: Schema,
  directory: string,
  options: Options = {},
) {
  const printContext = new PrintContext(
    getTypeScriptType,
    schema,
    new PrintOptions(options),
  );
  printSchemaInner(schema, printContext);
  await writeFiles(printContext, directory);
}
