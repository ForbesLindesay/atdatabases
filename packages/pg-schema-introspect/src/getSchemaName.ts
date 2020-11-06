import {Queryable, sql} from '@databases/pg';

export default async function getSchemaName(
  connection: Queryable,
  schemaID: number,
): Promise<string> {
  const namespaces = (await connection.query(
    sql`SELECT nspname FROM pg_catalog.pg_namespace WHERE oid = ${schemaID}`,
  )) as Array<{nspname: string}>;
  if (namespaces.length !== 1) {
    throw new Error(`Could not find schema with oid ${schemaID}`);
  }
  return namespaces[0].nspname;
}
