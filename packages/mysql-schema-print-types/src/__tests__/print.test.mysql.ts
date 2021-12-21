import getSchema, {connect, sql} from '@databases/mysql-schema-introspect';
import {PrintContext} from '@databases/shared-print-types';
import MySqlPrintOptions from '../MySqlPrintOptions';
import printSchema from '../printers/printSchema';

// JSON added in 5.7
const SUPPORTS_JSON_TYPE = !process.env.MYSQL_TEST_IMAGE?.includes(`:5.6`);

const db = connect({bigIntMode: 'number'});

afterAll(async () => {
  await db.dispose();
});
(SUPPORTS_JSON_TYPE ? test : test.skip)('print', async () => {
  await db.query(
    sql`
      CREATE TABLE print_types_users (
        id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        screen_name TEXT(512) NOT NULL,
        bio TEXT(512),
        age INT
      );
      CREATE TABLE print_types_photos (
        id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        owner_user_id BIGINT NOT NULL REFERENCES print_types.users(id),
        cdn_url TEXT(512) NOT NULL,
        caption TEXT(512) NULL,
        metadata JSON NOT NULL
      );
    `,
  );

  const rawSchema = await getSchema(db);
  const schema = {
    tables: rawSchema.tables.filter((t) =>
      t.tableName.startsWith(`print_types`),
    ),
  };

  const opts = new MySqlPrintOptions(
    {
      tableTypeName: '{{ TABLE_NAME | singular | pascal-case }}',
      columnTypeOverrides: {
        'photos.cdn_url': 'string & {__brand?: "url"}',
      },
      typeOverrides: {
        bigint: `number`,
      },
    },
    schema,
  );
  const printContext = new PrintContext(opts);
  printSchema(schema, printContext, opts);

  // await writeFiles(
  //   printContext,
  //   `${__dirname}/../../../pg-typed/src/__tests__/__generated__`,
  // );

  expect(printContext.getFiles()).toMatchInlineSnapshot(`
    Array [
      Object {
        "content": "import PrintTypesPhoto, {PrintTypesPhotos_InsertParameters} from './print_types_photos'
    import PrintTypesUser, {PrintTypesUsers_InsertParameters} from './print_types_users'

    interface DatabaseSchema {
      print_types_photos: {record: PrintTypesPhoto, insert: PrintTypesPhotos_InsertParameters};
      print_types_users: {record: PrintTypesUser, insert: PrintTypesUsers_InsertParameters};
    }
    export default DatabaseSchema;

    /**
     * JSON serialize values (v) if the table name (t) and column name (c)
     * is a JSON column.
     * This is necessary if you want to store values that are not plain objects
     * in a JSON column.
     */
    function serializeValue(t: string, c: string, v: unknown): unknown {
      if (t === \\"print_types_photos\\" && c === \\"metadata\\") {
        return JSON.stringify(v);
      }
      return v;
    }
    export {serializeValue}
    ",
        "filename": "index.ts",
      },
      Object {
        "content": "interface PrintTypesPhoto {
      caption: (string) | null
      cdn_url: string
      id: number & {readonly __brand?: 'print_types_photos_id'}
      metadata: unknown
      owner_user_id: number
    }
    export default PrintTypesPhoto;

    interface PrintTypesPhotos_InsertParameters {
      caption?: (string) | null
      cdn_url: string
      id: number & {readonly __brand?: 'print_types_photos_id'}
      metadata: unknown
      owner_user_id: number
    }
    export type {PrintTypesPhotos_InsertParameters}
    ",
        "filename": "print_types_photos.ts",
      },
      Object {
        "content": "interface PrintTypesUser {
      age: (number) | null
      bio: (string) | null
      id: number & {readonly __brand?: 'print_types_users_id'}
      screen_name: string
    }
    export default PrintTypesUser;

    interface PrintTypesUsers_InsertParameters {
      age?: (number) | null
      bio?: (string) | null
      id: number & {readonly __brand?: 'print_types_users_id'}
      screen_name: string
    }
    export type {PrintTypesUsers_InsertParameters}
    ",
        "filename": "print_types_users.ts",
      },
    ]
  `);
});
