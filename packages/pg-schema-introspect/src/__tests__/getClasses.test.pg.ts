import connect, {sql} from '@databases/pg';
import getClasses from '../getClasses';
import ClassKind from '../enums/ClassKind';

const db = connect({bigIntMode: 'number'});

test('getClasses', async () => {
  await db.query(sql`CREATE SCHEMA getclasses`);
  await db.query(
    sql`
      CREATE TABLE getclasses.table_a (id BIGSERIAL NOT NULL PRIMARY KEY);
      CREATE TABLE getclasses.table_b (id BIGSERIAL NOT NULL PRIMARY KEY);
      CREATE MATERIALIZED VIEW getclasses.view_a AS SELECT * FROM getclasses.table_a;
      CREATE VIEW getclasses.view_b AS SELECT * FROM getclasses.table_b;

      CREATE TABLE getclasses.partitioned (
        id INT NOT NULL,
        create_date DATE NOT NULL
      ) PARTITION BY RANGE (create_date);
      CREATE TABLE getclasses.partitioned_p0 PARTITION OF getclasses.partitioned FOR VALUES FROM ('1900-01-01') TO ('1999-12-31');
      CREATE TABLE getclasses.partitioned_p1 PARTITION OF getclasses.partitioned FOR VALUES FROM ('2000-01-01') TO ('2100-12-31');

      COMMENT ON TABLE getclasses.table_b IS 'This is a great table';
      COMMENT ON VIEW getclasses.view_b IS 'This is a great view';
    `,
  );

  expect(
    (
      await getClasses(db, {
        schemaName: 'getclasses',
        kind: [
          ClassKind.OrdinaryTable,
          ClassKind.PartitionedTable,
          ClassKind.View,
          ClassKind.MaterializedView,
        ],
      })
    ).map((t) => ({
      ...t,
      classID: typeof t.classID === 'number' ? '<oid>' : t.classID,
      schemaID: typeof t.schemaID === 'number' ? '<oid>' : t.schemaID,
    })),
  ).toMatchInlineSnapshot(`
Array [
  Object {
    "classID": "<oid>",
    "className": "partitioned",
    "comment": null,
    "kind": "p",
    "schemaID": "<oid>",
    "schemaName": "getclasses",
  },
  Object {
    "classID": "<oid>",
    "className": "partitioned_p0",
    "comment": null,
    "kind": "r",
    "schemaID": "<oid>",
    "schemaName": "getclasses",
  },
  Object {
    "classID": "<oid>",
    "className": "partitioned_p1",
    "comment": null,
    "kind": "r",
    "schemaID": "<oid>",
    "schemaName": "getclasses",
  },
  Object {
    "classID": "<oid>",
    "className": "table_a",
    "comment": null,
    "kind": "r",
    "schemaID": "<oid>",
    "schemaName": "getclasses",
  },
  Object {
    "classID": "<oid>",
    "className": "table_b",
    "comment": "This is a great table",
    "kind": "r",
    "schemaID": "<oid>",
    "schemaName": "getclasses",
  },
  Object {
    "classID": "<oid>",
    "className": "view_a",
    "comment": null,
    "kind": "m",
    "schemaID": "<oid>",
    "schemaName": "getclasses",
  },
  Object {
    "classID": "<oid>",
    "className": "view_b",
    "comment": "This is a great view",
    "kind": "v",
    "schemaID": "<oid>",
    "schemaName": "getclasses",
  },
]
`);
});
