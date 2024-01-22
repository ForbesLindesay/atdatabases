import {Schema, TableType} from '@databases/mysql-schema-introspect';
import printSchema from '../printers/printSchema';
import MySqlPrintOptions from '../MySqlPrintOptions';
import {PrintContext} from '@databases/shared-print-types';

test('replace filter', async () => {
  const schema: Schema = {
    tables: [
      {
        schemaName: `my_schema`,
        tableType: TableType.BaseTable,
        tableName: `my_table_my_name`,
        comment: ``,
        columns: [],
        constraints: [],
      },
    ],
  };
  const options = new MySqlPrintOptions(
    {
      tableTypeName:
        '{{ TABLE_NAME | replace "my_" "" | singular | pascal-case }}',
      tableInsertParametersTypeName:
        '{{ TABLE_NAME | replace "^my_" "" | singular | pascal-case }}Insert',
    },
    schema,
  );
  const printContext = new PrintContext(options);
  printSchema(schema, printContext, options);
  expect(printContext.getFiles()).toMatchInlineSnapshot(`
    Array [
      Object {
        "content": "import TableName, {TableMyNameInsert} from './my_table_my_name'

    interface DatabaseSchema {
      my_table_my_name: {record: TableName, insert: TableMyNameInsert};
    }
    export default DatabaseSchema;

    function serializeValue(_tableName: string, _columnName: string, value: unknown): unknown {
      return value;
    }
    export {serializeValue}
    ",
        "filename": "index.ts",
      },
      Object {
        "content": "interface TableMyNameInsert {
    }
    export type {TableMyNameInsert}

    interface TableName {
    }
    export default TableName;
    ",
        "filename": "my_table_my_name.ts",
      },
    ]
  `);
});
