import connect, {sql} from '@databases/mysql';
import getColumns from '../getColumns';
import getConstraints from '../getConstraints';

const db = connect({bigIntMode: 'number'});

test('getConstraints', async () => {
  await db.query(
    sql`
      CREATE TABLE get_constraints_table_a (
        id BIGINT NOT NULL PRIMARY KEY
      );
      CREATE TABLE get_constraints_table_b (
        id BIGINT NOT NULL PRIMARY KEY,
        parent_id BIGINT NOT NULL,
        value VARCHAR(50) NOT NULL,
        FOREIGN KEY (parent_id) REFERENCES get_constraints_table_a(id),
        UNIQUE (parent_id, value)
      );
      CREATE TABLE get_constraints_table_c (
        a BIGINT NOT NULL,
        b BIGINT NOT NULL,
        PRIMARY KEY (a, b),
        FOREIGN KEY (a) REFERENCES get_constraints_table_a(id),
        FOREIGN KEY (b) REFERENCES get_constraints_table_b(id)
      );
    `,
  );

  expect(
    (
      await getColumns(db, {
        schemaName: 'test-db',
      })
    ).filter((t) => t.tableName.startsWith(`get_constraints`)),
  ).toMatchInlineSnapshot(`
    Array [
      Object {
        "columnName": "id",
        "comment": "",
        "default": null,
        "isNullable": false,
        "isPrimaryKey": true,
        "ordinalPosition": 1,
        "schemaName": "test-db",
        "tableName": "get_constraints_table_a",
        "type": Object {
          "kind": "bigint",
        },
      },
      Object {
        "columnName": "id",
        "comment": "",
        "default": null,
        "isNullable": false,
        "isPrimaryKey": true,
        "ordinalPosition": 1,
        "schemaName": "test-db",
        "tableName": "get_constraints_table_b",
        "type": Object {
          "kind": "bigint",
        },
      },
      Object {
        "columnName": "parent_id",
        "comment": "",
        "default": null,
        "isNullable": false,
        "isPrimaryKey": false,
        "ordinalPosition": 2,
        "schemaName": "test-db",
        "tableName": "get_constraints_table_b",
        "type": Object {
          "kind": "bigint",
        },
      },
      Object {
        "columnName": "value",
        "comment": "",
        "default": null,
        "isNullable": false,
        "isPrimaryKey": false,
        "ordinalPosition": 3,
        "schemaName": "test-db",
        "tableName": "get_constraints_table_b",
        "type": Object {
          "kind": "varchar",
          "length": 50,
        },
      },
      Object {
        "columnName": "a",
        "comment": "",
        "default": null,
        "isNullable": false,
        "isPrimaryKey": true,
        "ordinalPosition": 1,
        "schemaName": "test-db",
        "tableName": "get_constraints_table_c",
        "type": Object {
          "kind": "bigint",
        },
      },
      Object {
        "columnName": "b",
        "comment": "",
        "default": null,
        "isNullable": false,
        "isPrimaryKey": true,
        "ordinalPosition": 2,
        "schemaName": "test-db",
        "tableName": "get_constraints_table_c",
        "type": Object {
          "kind": "bigint",
        },
      },
    ]
  `);
  expect(
    (
      await getConstraints(db, {
        schemaName: 'test-db',
      })
    ).filter((t) => t.tableName.startsWith(`get_constraints`)),
  ).toMatchInlineSnapshot(`
    Array [
      Object {
        "columns": Array [
          Object {
            "columnName": "id",
            "referenced": null,
          },
        ],
        "constraintName": "PRIMARY",
        "schemaName": "test-db",
        "tableName": "get_constraints_table_a",
      },
      Object {
        "columns": Array [
          Object {
            "columnName": "id",
            "referenced": null,
          },
        ],
        "constraintName": "PRIMARY",
        "schemaName": "test-db",
        "tableName": "get_constraints_table_b",
      },
      Object {
        "columns": Array [
          Object {
            "columnName": "parent_id",
            "referenced": Object {
              "columnName": "id",
              "schemaName": "test-db",
              "tableName": "get_constraints_table_a",
            },
          },
        ],
        "constraintName": "get_constraints_table_b_ibfk_1",
        "schemaName": "test-db",
        "tableName": "get_constraints_table_b",
      },
      Object {
        "columns": Array [
          Object {
            "columnName": "parent_id",
            "referenced": null,
          },
          Object {
            "columnName": "value",
            "referenced": null,
          },
        ],
        "constraintName": "parent_id",
        "schemaName": "test-db",
        "tableName": "get_constraints_table_b",
      },
      Object {
        "columns": Array [
          Object {
            "columnName": "a",
            "referenced": null,
          },
          Object {
            "columnName": "b",
            "referenced": null,
          },
        ],
        "constraintName": "PRIMARY",
        "schemaName": "test-db",
        "tableName": "get_constraints_table_c",
      },
      Object {
        "columns": Array [
          Object {
            "columnName": "a",
            "referenced": Object {
              "columnName": "id",
              "schemaName": "test-db",
              "tableName": "get_constraints_table_a",
            },
          },
        ],
        "constraintName": "get_constraints_table_c_ibfk_1",
        "schemaName": "test-db",
        "tableName": "get_constraints_table_c",
      },
      Object {
        "columns": Array [
          Object {
            "columnName": "b",
            "referenced": Object {
              "columnName": "id",
              "schemaName": "test-db",
              "tableName": "get_constraints_table_b",
            },
          },
        ],
        "constraintName": "get_constraints_table_c_ibfk_2",
        "schemaName": "test-db",
        "tableName": "get_constraints_table_c",
      },
    ]
  `);

  await db.dispose();
});
