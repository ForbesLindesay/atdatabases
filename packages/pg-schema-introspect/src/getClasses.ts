import {Connection, sql} from '@databases/pg';
import ClassKind from './enums/ClassKind';

export interface ClassQuery {
  schemaID?: number;
  schemaName?: string;
  classID?: number;
  className?: string;
  kind?: ClassKind | ClassKind[];
}
export interface Class {
  schemaID: number;
  schemaName: string;
  classID: number;
  className: string;
  kind: ClassKind;
  comment: string | null;
}
export default async function getClasses(
  connection: Connection,
  query: ClassQuery,
): Promise<Class[]> {
  const conditions = classQuery(query);

  const tables = await connection.query(sql`
    SELECT
      ns.oid as "schemaID",
      ns.nspname as "schemaName",
      cls.oid as "classID",
      cls.relname as "className",
      cls.relkind as "kind",
      obj_description(cls.oid, 'pg_class') as "comment"
    FROM pg_catalog.pg_class cls
    INNER JOIN pg_catalog.pg_namespace ns
      ON (cls.relnamespace = ns.oid)
    ${
      conditions.length ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``
    }
    ORDER BY cls.relname;
  `);

  return tables;
}

export function classQuery(query: ClassQuery) {
  const conditions = [];
  if (query.kind) {
    if (Array.isArray(query.kind)) {
      conditions.push(
        sql`cls.relkind IN (${sql.join(
          query.kind.map((k) => sql`${k}`),
          sql`, `,
        )})`,
      );
    } else {
      conditions.push(sql`cls.relkind = ${query.kind}`);
    }
  }
  if (query.schemaName) {
    conditions.push(sql`ns.nspname = ${query.schemaName}`);
  }
  if (query.schemaID) {
    conditions.push(sql`ns.oid = ${query.schemaID}`);
  }
  if (query.className) {
    conditions.push(sql`cls.relname = ${query.className}`);
  }
  if (query.classID) {
    conditions.push(sql`cls.oid = ${query.classID}`);
  }
  return conditions;
}
