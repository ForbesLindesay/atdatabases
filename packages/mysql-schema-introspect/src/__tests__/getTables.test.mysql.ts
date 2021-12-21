import connect, {sql} from '@databases/mysql';
import TableType from '../enums/TableType';
import getTables from '../getTables';

const db = connect({bigIntMode: 'number'});

test('getTables', async () => {
  await db.query(
    sql`
      CREATE TABLE get_tables_table_a (id BIGINT NOT NULL PRIMARY KEY);
      CREATE TABLE get_tables_table_b (id BIGINT NOT NULL PRIMARY KEY);
      CREATE VIEW get_tables_view_b AS SELECT * FROM get_tables_table_b;

      ALTER TABLE get_tables_table_b COMMENT = 'This is a great table';
    `,
  );

  expect(
    (
      await getTables(db, {
        schemaName: 'test-db',
        type: [TableType.BaseTable, TableType.View],
      })
    ).filter((t) => t.tableName.startsWith(`get_tables`)),
  ).toMatchInlineSnapshot(`
    Array [
      Object {
        "comment": "",
        "schemaName": "test-db",
        "tableName": "get_tables_table_a",
        "tableType": "BASE TABLE",
      },
      Object {
        "comment": "This is a great table",
        "schemaName": "test-db",
        "tableName": "get_tables_table_b",
        "tableType": "BASE TABLE",
      },
      Object {
        "comment": "",
        "schemaName": "test-db",
        "tableName": "get_tables_view_b",
        "tableType": "VIEW",
      },
    ]
  `);

  await db.dispose();
});
