import {Queryable, sql} from '@databases/pg';
import {typeQuery, TypeQuery} from './getTypes';

export interface EnumValue {
  schemaID: number;
  schemaName: string;
  typeID: number;
  typeName: string;
  value: string;
}
export default async function getEnumValues(
  connection: Queryable,
  query: TypeQuery,
): Promise<EnumValue[]> {
  const conditions = typeQuery(query);

  const enumValues = await connection.query(sql`
    SELECT
      ns.oid AS "schemaID",
      ns.nspname AS "schemaName",
      ty.oid AS "typeID",
      ty.typname AS "typeName",
      e.enumlabel AS "value"
    FROM pg_catalog.pg_enum e
    INNER JOIN pg_catalog.pg_type ty
      ON (e.enumtypid = ty.oid)
    INNER JOIN pg_catalog.pg_namespace ns
      ON (ty.typnamespace = ns.oid)
    LEFT OUTER JOIN pg_catalog.pg_type subt
      ON (ty.typelem = subt.oid)
    ${
      conditions.length ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``
    }
    ORDER BY ns.nspname ASC, ty.typname ASC, e.enumlabel ASC
  `);

  return enumValues;
}
