import {Connection, sql} from '@databases/pg';

interface Options {
  includeNonExistantSchemas?: boolean;
}
export default async function getSearchPath(
  connection: Connection,
  options: Options = {},
): Promise<string[]> {
  const [[{current_user}], [{search_path}], namespaces] = await Promise.all([
    connection.query(sql`SELECT current_user;`) as Promise<
      [{current_user: string}]
    >,
    connection.query(sql`SHOW search_path;`) as Promise<
      [{search_path: string}]
    >,
    options.includeNonExistantSchemas
      ? Promise.resolve(null)
      : (connection.query(
          sql`SELECT nspname FROM pg_catalog.pg_namespace`,
        ) as Promise<Array<{nspname: string}>>),
  ]);
  const schemaNames = namespaces && namespaces.map(n => n.nspname);
  const searchPath = search_path
    .split(',')
    .map(p => p.trim())
    .map(p => (p[0] === '"' ? (JSON.parse(p) as string) : p))
    .map(p => (p === '$user' ? current_user : p))
    .filter(p => !schemaNames || schemaNames.includes(p));
  return searchPath;
}
