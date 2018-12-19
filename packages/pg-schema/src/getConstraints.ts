import {Connection, sql} from '@databases/pg';
import {classQuery, ClassQuery} from './getClasses';
import ConstraintType from './enums/ConstraintType';
import ForeignKeyAction from './enums/ForeginKeyAction';
import ForeignKeyMatchType from './enums/ForeignKeyMatchType';

export interface ConstraintQuery extends ClassQuery {}
export interface Constraint {
  /**
   * N.B. the name of the constraint is not necessarily unique
   */
  constraintName: string;
  constraintType: ConstraintType;
  /**
   * 0 if not a table constraint
   */
  classID: number;
  /**
   * 0 if not a foreign key
   */
  referencedClassID: number;

  foreignKeyUpdateAction: ForeignKeyAction;
  foreignKeyDeletionAction: ForeignKeyAction;
  foreignKeyMatchType: ForeignKeyMatchType;

  checkConstraint: string;

  // 	pg_attribute.attnum
  tableAttributeNumbers: number[];
  // 	pg_attribute.attnum
  referencedAttributeNumbers: number[];
}
export default async function getConstraints(
  connection: Connection,
  query: ConstraintQuery,
): Promise<Constraint[]> {
  const conditions = classQuery(query);

  const constraints = await connection.query(sql`
    SELECT
      conname AS "constraintName",
      contype AS "constraintType",
      conrelid AS "classID",
      confrelid AS "referencedClassID",
      confupdtype AS "foreignKeyUpdateAction",
      confdeltype AS "foreignKeyDeletionAction",
      confmatchtype AS "foreignKeyMatchType",
      conkey AS "tableAttributeNumbers",
      confkey AS "referencedAttributeNumbers",
      consrc AS "checkConstraint"
    FROM pg_catalog.pg_constraint c
    INNER JOIN pg_catalog.pg_class cls
      ON (c.conindid = cls.oid)
    INNER JOIN pg_catalog.pg_namespace ns
      ON (c.connamespace = ns.oid)
    ${conditions.length ? sql`WHERE ${sql.join(conditions, ' AND ')}` : sql``}
  `);

  return constraints;
}
