import MySqlConfig from '@databases/mysql-config';
import type {Schema} from '@databases/mysql-schema-introspect';
import {PrintContext, writeFiles} from '@databases/shared-print-types';
import MySqlPrintOptions from './MySqlPrintOptions';
import printSchemaInner from './printers/printSchema';

const GENERATED_STATEMENT = 'Generated by: @databases/pg-schema-print-types';

export type Options = Omit<Partial<MySqlConfig['types']>, 'directory'>;

export function printSchema(schema: Schema, options: Options = {}) {
  const opts = new MySqlPrintOptions(options, schema);
  const context = new PrintContext(opts);
  printSchemaInner(schema, context, opts);
  return context.getFiles();
}

export async function writeSchema(
  schema: Schema,
  directory: string,
  options: Options = {},
) {
  const opts = new MySqlPrintOptions(options, schema);
  const context = new PrintContext(opts);
  printSchemaInner(schema, context, opts);
  await writeFiles({
    context,
    directory,
    generatedStatement: GENERATED_STATEMENT,
  });
}
