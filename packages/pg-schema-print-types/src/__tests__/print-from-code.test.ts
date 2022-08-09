import {ClassKind, Schema} from '@databases/pg-schema-introspect';
import PgPrintContext from '../PgPrintContext';
import getTypeScriptType from '../getTypeScriptType';
import PrintOptions from '../PgPrintOptions';
import printSchema from '../printers/printSchema';

test('replace filter', async () => {
  const schema: Schema = {
    types: [],
    classes: [
      {
        schemaID: 42,
        schemaName: `my_schema`,
        classID: 10,
        className: `my_table_my_name`,
        kind: ClassKind.OrdinaryTable,
        comment: null,
        attributes: [],
        constraints: [],
      },
    ],
  };
  const printContext = new PgPrintContext(
    getTypeScriptType,
    schema,
    new PrintOptions({
      tableTypeName:
        '{{ TABLE_NAME | replace "my_" "" | singular | pascal-case }}',
      tableInsertParametersTypeName:
        '{{ TABLE_NAME | replace "^my_" "" | singular | pascal-case }}Insert',
    }),
  );
  printSchema(schema, printContext);
  expect(printContext.printer.getFiles()).toMatchInlineSnapshot(`
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

    export type {
      TableMyNameInsert,
      TableName,
    }
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
      Object {
        "content": "[
      {
        \\"name\\": \\"my_table_my_name\\",
        \\"columns\\": []
      }
    ]
    ",
        "filename": "schema.json",
      },
    ]
  `);
});
