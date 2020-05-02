import {Connection, sql} from '@databases/pg';
import TypeCateogry from './enums/TypeCategory';
import TypeKind from './enums/TypeKind';
import getAttributes, {Attribute} from './getAttributes';
import getEnumValues from './getEnumValues';

export interface TypeQuery {
  schemaID?: number;
  schemaName?: string;
  typeID?: number;
  typeName?: string;
  category?: TypeCateogry;
}
export interface TypeRecord {
  schemaID: number;
  schemaName: string;
  typeID: number;
  typeName: string;
  kind: TypeKind;
  category: TypeCateogry;
  /**
   * classID if composite type
   */
  classID?: number;
  subtypeID?: number;
  subtypeName?: string;
  basetypeID?: number;
  basetypeName?: string;
  comment: string | null;
}

export interface TypeBase {
  schemaID: number;
  schemaName: string;
  typeID: number;
  typeName: string;
  kind: TypeKind;
  category: TypeCateogry;
  comment: string | null;
}

export interface ArrayType extends TypeBase {
  kind: TypeKind.Array;
  subtypeID: number;
  subtypeName: string;
}
export interface BaseType extends TypeBase {
  kind: TypeKind.Base;
  subtypeID?: number;
  subtypeName?: string;
}
export interface CompositeType extends TypeBase {
  kind: TypeKind.Composite;
  classID: number;
  attributes: Attribute[];
}
export interface DomainType extends TypeBase {
  kind: TypeKind.Domain;
  basetypeID: number;
  basetypeName: string;
}
export interface EnumType extends TypeBase {
  kind: TypeKind.Enum;
  values: string[];
}
export interface PseudoType extends TypeBase {
  kind: TypeKind.Pseudo;
}

export type Type =
  | ArrayType
  | BaseType
  | CompositeType
  | DomainType
  | EnumType
  | PseudoType;

export default async function getTypes(
  connection: Connection,
  query: TypeQuery = {},
): Promise<Type[]> {
  const conditions = typeQuery(query);

  const typeRecords = (await connection.query(sql`
    SELECT
      ns.oid AS "schemaID",
      ns.nspname AS "schemaName",
      ty.oid as "typeID",
      ty.typname AS "typeName",
      ty.typtype AS "kind",
      ty.typcategory AS "category",
      ty.typrelid AS "classID",
      subt.oid as "subtypeID",
      subt.typname AS "subtypeName",
      baset.oid as "basetypeID",
      baset.typname AS "basetypeName",
      
      obj_description(ty.oid, 'pg_type') as "comment"
    FROM pg_catalog.pg_type ty
    INNER JOIN pg_catalog.pg_namespace ns
      ON (ty.typnamespace = ns.oid)
    LEFT OUTER JOIN pg_catalog.pg_type subt
      ON (ty.typelem = subt.oid)
    LEFT OUTER JOIN pg_catalog.pg_type baset
      ON (ty.typbasetype = baset.oid)
    ${
      conditions.length ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``
    }
  `)) as TypeRecord[];

  return Promise.all(
    typeRecords.map(
      async (tr): Promise<Type> => {
        const base: TypeBase = {
          schemaID: tr.schemaID,
          schemaName: tr.schemaName,
          typeID: tr.typeID,
          typeName: tr.typeName,
          kind: tr.kind,
          category: tr.category,
          comment: tr.comment,
        };
        switch (base.kind) {
          case TypeKind.Array:
          case TypeKind.Base:
            if (tr.category === TypeCateogry.Array) {
              return {
                ...base,
                kind: TypeKind.Array,
                subtypeID: tr.subtypeID!,
                subtypeName: tr.subtypeName!,
              };
            } else {
              return {
                ...base,
                kind: TypeKind.Base,
                subtypeID: tr.subtypeID,
                subtypeName: tr.subtypeName,
              };
            }
          case TypeKind.Composite:
            return {
              ...base,
              kind: TypeKind.Composite,
              classID: tr.classID!,
              attributes: await getAttributes(connection, {
                classID: tr.classID!,
              }),
            };
          case TypeKind.Domain:
            return {
              ...base,
              kind: TypeKind.Domain,
              basetypeID: tr.basetypeID!,
              basetypeName: tr.basetypeName!,
            };
          case TypeKind.Enum:
            return {
              ...base,
              kind: TypeKind.Enum,
              values: (
                await getEnumValues(connection, {
                  typeID: tr.typeID,
                })
              ).map(v => v.value),
            };
          case TypeKind.Pseudo:
            return {
              ...base,
              kind: TypeKind.Pseudo,
            };
          default:
            const kind: never = base.kind;
            return {
              ...base,
              kind,
            };
        }
      },
    ),
  );
}

export function typeQuery(query: TypeQuery) {
  const conditions = [];
  if (query.schemaID) {
    conditions.push(sql`ns.oid = ${query.schemaID}`);
  }
  if (query.schemaName) {
    conditions.push(sql`ns.nspname = ${query.schemaName}`);
  }
  if (query.typeID) {
    conditions.push(sql`ty.oid = ${query.typeID}`);
  }
  if (query.typeName) {
    conditions.push(sql`ty.typname = ${query.typeName}`);
  }
  if (query.category) {
    conditions.push(sql`ty.typcategory = ${query.category}`);
  }
  return conditions;
}
