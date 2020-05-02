import connect, {sql} from '@databases/pg';
import getConstraints from '../getConstraints';

const db = connect();

test('getConstraints', async () => {
  await db.query(sql`CREATE SCHEMA getconstraints`);
  await db.query(
    sql`
      CREATE TABLE getconstraints.table_a (
        id BIGSERIAL NOT NULL PRIMARY KEY
      );
      CREATE TABLE getconstraints.table_b (
        id BIGSERIAL NOT NULL PRIMARY KEY,
        a_id BIGINT NOT NULL REFERENCES getconstraints.table_a(id)
      );

      CREATE TABLE getconstraints.table_c (
        a BIGINT NOT NULL,
        b BIGINT NOT NULL,
        PRIMARY KEY (a, b)  
      );
    `,
  );

  expect(
    (
      await getConstraints(db, {
        schemaName: 'getconstraints',
        // kind: [ClassKind.OrdinaryTable, ClassKind.View],
      })
    ).map(t => ({
      ...t,
      classID: typeof t.classID === 'number' ? '<oid>' : t.classID,
      referencedClassID:
        typeof t.referencedClassID === 'number' ? '<oid>' : t.referencedClassID,
    })),
  ).toMatchInlineSnapshot(`
Array [
  Object {
    "checkConstraint": null,
    "classID": "<oid>",
    "constraintName": "table_a_pkey",
    "constraintType": "p",
    "foreignKeyDeletionAction": " ",
    "foreignKeyMatchType": " ",
    "foreignKeyUpdateAction": " ",
    "referencedAttributeNumbers": null,
    "referencedClassID": "<oid>",
    "tableAttributeNumbers": Array [
      1,
    ],
  },
  Object {
    "checkConstraint": null,
    "classID": "<oid>",
    "constraintName": "table_b_pkey",
    "constraintType": "p",
    "foreignKeyDeletionAction": " ",
    "foreignKeyMatchType": " ",
    "foreignKeyUpdateAction": " ",
    "referencedAttributeNumbers": null,
    "referencedClassID": "<oid>",
    "tableAttributeNumbers": Array [
      1,
    ],
  },
  Object {
    "checkConstraint": null,
    "classID": "<oid>",
    "constraintName": "table_b_a_id_fkey",
    "constraintType": "f",
    "foreignKeyDeletionAction": "a",
    "foreignKeyMatchType": "s",
    "foreignKeyUpdateAction": "a",
    "referencedAttributeNumbers": Array [
      1,
    ],
    "referencedClassID": "<oid>",
    "tableAttributeNumbers": Array [
      2,
    ],
  },
  Object {
    "checkConstraint": null,
    "classID": "<oid>",
    "constraintName": "table_c_pkey",
    "constraintType": "p",
    "foreignKeyDeletionAction": " ",
    "foreignKeyMatchType": " ",
    "foreignKeyUpdateAction": " ",
    "referencedAttributeNumbers": null,
    "referencedClassID": "<oid>",
    "tableAttributeNumbers": Array [
      1,
      2,
    ],
  },
]
`);
});
