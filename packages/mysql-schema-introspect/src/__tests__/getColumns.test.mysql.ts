import connect, {sql} from '@databases/mysql';
import getColumns from '../getColumns';

const db = connect({bigIntMode: 'number'});

test('getColumns', async () => {
  await db.query(
    sql`
      CREATE TABLE get_columns_table (
        id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        str VARCHAR(50) NOT NULL DEFAULT 'Hello World',
        str2 VARCHAR(50) NOT NULL,
        str3 VARCHAR(50) NULL,
        int_with_default INT DEFAULT 42
      );
      CREATE VIEW get_columns_view AS SELECT * FROM get_columns_table;
    `,
  );

  expect(
    (
      await getColumns(db, {
        schemaName: 'test-db',
      })
    ).filter((c) => c.tableName.startsWith(`get_columns`)),
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
        "tableName": "get_columns_table",
        "type": Object {
          "kind": "bigint",
        },
      },
      Object {
        "columnName": "int_with_default",
        "comment": "",
        "default": "42",
        "isNullable": true,
        "isPrimaryKey": false,
        "ordinalPosition": 5,
        "schemaName": "test-db",
        "tableName": "get_columns_table",
        "type": Object {
          "kind": "int",
        },
      },
      Object {
        "columnName": "str",
        "comment": "",
        "default": "Hello World",
        "isNullable": false,
        "isPrimaryKey": false,
        "ordinalPosition": 2,
        "schemaName": "test-db",
        "tableName": "get_columns_table",
        "type": Object {
          "kind": "varchar",
          "length": 50,
        },
      },
      Object {
        "columnName": "str2",
        "comment": "",
        "default": null,
        "isNullable": false,
        "isPrimaryKey": false,
        "ordinalPosition": 3,
        "schemaName": "test-db",
        "tableName": "get_columns_table",
        "type": Object {
          "kind": "varchar",
          "length": 50,
        },
      },
      Object {
        "columnName": "str3",
        "comment": "",
        "default": null,
        "isNullable": true,
        "isPrimaryKey": false,
        "ordinalPosition": 4,
        "schemaName": "test-db",
        "tableName": "get_columns_table",
        "type": Object {
          "kind": "varchar",
          "length": 50,
        },
      },
      Object {
        "columnName": "id",
        "comment": "",
        "default": "0",
        "isNullable": false,
        "isPrimaryKey": false,
        "ordinalPosition": 1,
        "schemaName": "test-db",
        "tableName": "get_columns_view",
        "type": Object {
          "kind": "bigint",
        },
      },
      Object {
        "columnName": "int_with_default",
        "comment": "",
        "default": "42",
        "isNullable": true,
        "isPrimaryKey": false,
        "ordinalPosition": 5,
        "schemaName": "test-db",
        "tableName": "get_columns_view",
        "type": Object {
          "kind": "int",
        },
      },
      Object {
        "columnName": "str",
        "comment": "",
        "default": "Hello World",
        "isNullable": false,
        "isPrimaryKey": false,
        "ordinalPosition": 2,
        "schemaName": "test-db",
        "tableName": "get_columns_view",
        "type": Object {
          "kind": "varchar",
          "length": 50,
        },
      },
      Object {
        "columnName": "str2",
        "comment": "",
        "default": null,
        "isNullable": false,
        "isPrimaryKey": false,
        "ordinalPosition": 3,
        "schemaName": "test-db",
        "tableName": "get_columns_view",
        "type": Object {
          "kind": "varchar",
          "length": 50,
        },
      },
      Object {
        "columnName": "str3",
        "comment": "",
        "default": null,
        "isNullable": true,
        "isPrimaryKey": false,
        "ordinalPosition": 4,
        "schemaName": "test-db",
        "tableName": "get_columns_view",
        "type": Object {
          "kind": "varchar",
          "length": 50,
        },
      },
    ]
  `);

  await db.dispose();
});
