import {expect, test} from '@jest/globals';
import connect, {sql} from '@databases/pg';
import getConstraints from '../getConstraints';

const db = connect({bigIntMode: 'number'});

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
    ).map((t) => ({
      ...t,
      classID: typeof t.classID === 'number' ? '<oid>' : t.classID,
      referencedClassID:
        typeof t.referencedClassID === 'number' ? '<oid>' : t.referencedClassID,
    })),
  ).toMatchInlineSnapshot(`
    [
      {
        "classID": "<oid>",
        "constraintDescription": "PRIMARY KEY (id)",
        "constraintName": "table_a_pkey",
        "constraintType": "p",
        "foreignKeyDeletionAction": " ",
        "foreignKeyMatchType": " ",
        "foreignKeyUpdateAction": " ",
        "referencedAttributeNumbers": null,
        "referencedClassID": "<oid>",
        "tableAttributeNumbers": [
          1,
        ],
      },
      {
        "classID": "<oid>",
        "constraintDescription": "FOREIGN KEY (a_id) REFERENCES getconstraints.table_a(id)",
        "constraintName": "table_b_a_id_fkey",
        "constraintType": "f",
        "foreignKeyDeletionAction": "a",
        "foreignKeyMatchType": "s",
        "foreignKeyUpdateAction": "a",
        "referencedAttributeNumbers": [
          1,
        ],
        "referencedClassID": "<oid>",
        "tableAttributeNumbers": [
          2,
        ],
      },
      {
        "classID": "<oid>",
        "constraintDescription": "PRIMARY KEY (id)",
        "constraintName": "table_b_pkey",
        "constraintType": "p",
        "foreignKeyDeletionAction": " ",
        "foreignKeyMatchType": " ",
        "foreignKeyUpdateAction": " ",
        "referencedAttributeNumbers": null,
        "referencedClassID": "<oid>",
        "tableAttributeNumbers": [
          1,
        ],
      },
      {
        "classID": "<oid>",
        "constraintDescription": "PRIMARY KEY (a, b)",
        "constraintName": "table_c_pkey",
        "constraintType": "p",
        "foreignKeyDeletionAction": " ",
        "foreignKeyMatchType": " ",
        "foreignKeyUpdateAction": " ",
        "referencedAttributeNumbers": null,
        "referencedClassID": "<oid>",
        "tableAttributeNumbers": [
          1,
          2,
        ],
      },
    ]
  `);
});
