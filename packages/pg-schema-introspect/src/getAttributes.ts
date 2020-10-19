import {Connection, sql} from '@databases/pg';
import {ClassQuery, classQuery} from './getClasses';

export interface AttributeQuery extends ClassQuery {
  column?: string;
  includeSystemColumns?: boolean;
}
export interface Attribute {
  schemaID: number;
  schemaName: string;
  classID: number;
  className: string;
  attributeNumber: number;
  attributeName: string;

  typeID: number;
  typeLength: number;

  notNull: boolean;
  hasDefault: boolean;
  default: string;
  comment: string;
}
export default async function getAttributes(
  connection: Connection,
  query: AttributeQuery,
): Promise<Attribute[]> {
  const conditions = classQuery(query);
  if (query.column) {
    conditions.push(sql`a.attname = ${query.column}`);
  }
  if (!query.column && !query.includeSystemColumns) {
    conditions.push(sql`a.attnum > 0`);
  }
  conditions.push(sql`a.attisdropped = false`);

  const attributes: Attribute[] = await connection.query(sql`
    SELECT
      ns.oid AS "schemaID",
      ns.nspname AS "schemaName",
      cls.oid AS "classID",
      cls.relname AS "className",
      a.attnum as "attributeNumber",
      a.attname AS "attributeName",

      a.attnotnull AS "notNull",
      a.atthasdef AS "hasDefault",
      pg_get_expr(def.adbin, def.adrelid, true) AS "default",
      col_description(a.attrelid, a.attnum) AS "comment",

      a.atttypid AS "typeID",
      a.atttypmod AS "typeLength"
    FROM pg_catalog.pg_attribute a
    INNER JOIN pg_catalog.pg_class cls
      ON (a.attrelid = cls.oid)
    INNER JOIN pg_catalog.pg_namespace ns
      ON (cls.relnamespace = ns.oid)
    LEFT OUTER JOIN pg_catalog.pg_attrdef def -- default values
      ON (def.adrelid = cls.oid AND def.adnum = a.attnum)
    ${
      conditions.length ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``
    }
    ORDER BY ns.nspname ASC, cls.relname ASC, a.attname ASC;
  `);

  return attributes;
}
