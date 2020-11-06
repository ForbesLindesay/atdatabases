import connect, {sql} from '@databases/pg';
import getAttributes from '../getAttributes';

const db = connect({bigIntMode: 'number'});

test('getAttributes', async () => {
  await db.query(sql`CREATE SCHEMA getattributes`);
  await db.query(
    sql`
      CREATE TYPE getattributes.kind AS ENUM('FirstKind', 'SecondKind');
      COMMENT ON TYPE getattributes.kind IS 'There are two kinds of thing';
      CREATE TABLE getattributes.table (
        id BIGSERIAL NOT NULL PRIMARY KEY,
        value TEXT NOT NULL DEFAULT '',
        something TIMESTAMPTZ NULL,
        kind getattributes.kind NOT NULL,
        twenty_chars VARCHAR(20) NOT NULL
      );
      COMMENT ON COLUMN getattributes.table.id IS 'This is the table''s primary key';
      COMMENT ON COLUMN getattributes.table.value IS 'Each record has a value that is a string';
      COMMENT ON COLUMN getattributes.table.something IS 'Each record might have a timestamp';
    `,
  );

  expect(
    (
      await getAttributes(db, {
        className: 'table',
        schemaName: 'getattributes',
      })
    ).map((c) => ({
      ...c,
      schemaID: typeof c.schemaID === 'number' ? '<oid>' : c.schemaID,
      classID: typeof c.classID === 'number' ? '<oid>' : c.classID,
      typeID: typeof c.typeID === 'number' ? '<oid>' : c.typeID,
    })),
  ).toMatchInlineSnapshot(`
    Array [
      Object {
        "attributeName": "id",
        "attributeNumber": 1,
        "classID": "<oid>",
        "className": "table",
        "comment": "This is the table's primary key",
        "default": "nextval('getattributes.table_id_seq'::regclass)",
        "hasDefault": true,
        "notNull": true,
        "schemaID": "<oid>",
        "schemaName": "getattributes",
        "typeID": "<oid>",
        "typeLength": -1,
      },
      Object {
        "attributeName": "kind",
        "attributeNumber": 4,
        "classID": "<oid>",
        "className": "table",
        "comment": null,
        "default": null,
        "hasDefault": false,
        "notNull": true,
        "schemaID": "<oid>",
        "schemaName": "getattributes",
        "typeID": "<oid>",
        "typeLength": -1,
      },
      Object {
        "attributeName": "something",
        "attributeNumber": 3,
        "classID": "<oid>",
        "className": "table",
        "comment": "Each record might have a timestamp",
        "default": null,
        "hasDefault": false,
        "notNull": false,
        "schemaID": "<oid>",
        "schemaName": "getattributes",
        "typeID": "<oid>",
        "typeLength": -1,
      },
      Object {
        "attributeName": "twenty_chars",
        "attributeNumber": 5,
        "classID": "<oid>",
        "className": "table",
        "comment": null,
        "default": null,
        "hasDefault": false,
        "notNull": true,
        "schemaID": "<oid>",
        "schemaName": "getattributes",
        "typeID": "<oid>",
        "typeLength": 24,
      },
      Object {
        "attributeName": "value",
        "attributeNumber": 2,
        "classID": "<oid>",
        "className": "table",
        "comment": "Each record has a value that is a string",
        "default": "''::text",
        "hasDefault": true,
        "notNull": true,
        "schemaID": "<oid>",
        "schemaName": "getattributes",
        "typeID": "<oid>",
        "typeLength": -1,
      },
    ]
  `);
});
