import PgDataTypeID from '@databases/pg-data-type-id';
import getSchema, {connect, sql} from '@databases/pg-schema-introspect';
import PrintContext from '../PrintContext';
import getTypeScriptType from '../getTypeScriptType';
import PrintOptions from '../PrintOptions';
import printSchema from '../printers/printSchema';
import writeFiles from '../writeFiles';

const db = connect();

afterAll(async () => {
  await db.dispose();
});
test('getClasses', async () => {
  await db.query(sql`CREATE SCHEMA print_types`);
  await db.query(
    sql`
      CREATE TABLE print_types.users (
        id BIGSERIAL NOT NULL PRIMARY KEY,
        screen_name TEXT UNIQUE NOT NULL,
        bio TEXT,
        age INT
      );
      CREATE TABLE print_types.photos (
        id BIGSERIAL NOT NULL PRIMARY KEY,
        owner_user_id BIGINT NOT NULL REFERENCES print_types.users(id),
        cdn_url TEXT NOT NULL,
        caption TEXT NULL,
        metadata JSONB NOT NULL
      );
      CREATE MATERIALIZED VIEW print_types.view_a AS SELECT * FROM print_types.users;
      CREATE VIEW print_types.view_b AS SELECT * FROM print_types.photos;

      COMMENT ON TABLE print_types.photos IS 'This is a great table';
      COMMENT ON VIEW print_types.view_b IS 'This is a great view';
    `,
  );

  const schema = await getSchema(db, {
    schemaName: 'print_types',
  });

  const printContext = new PrintContext(
    getTypeScriptType,
    schema,
    new PrintOptions({
      tableTypeName: '{{ TABLE_NAME | singular | pascal-case }}',
      columnTypeOverrides: {
        'photos.cdn_url': 'string & {__brand?: "url"}',
      },
      typeOverrides: {
        [PgDataTypeID.jsonb]: 'unknown',
      },
    }),
  );
  printSchema(schema, printContext);
  await writeFiles(
    printContext,
    `${__dirname}/../../../pg-typed/src/__tests__/__generated__`,
  );

  expect(printContext.getFiles()).toMatchInlineSnapshot(`
    Array [
      Object {
        "content": "import Photo, {Photos_InsertParameters} from './photos'
    import User, {Users_InsertParameters} from './users'

    interface DatabaseSchema {
      photos: {record: Photo, insert: Photos_InsertParameters};
      users: {record: User, insert: Users_InsertParameters};
    }
    export default DatabaseSchema;
    ",
        "filename": "index.ts",
      },
      Object {
        "content": "import User from './users'

    /**
     * This is a great table
     */
    interface Photo {
      caption: (string) | null
      cdn_url: string & {__brand?: \\"url\\"}
      /**
       * @default nextval('print_types.photos_id_seq'::regclass)
       */
      id: number & {readonly __brand?: 'photos_id'}
      metadata: unknown
      owner_user_id: User['id']
    }
    export default Photo;

    /**
     * This is a great table
     */
    interface Photos_InsertParameters {
      caption?: (string) | null
      cdn_url: string & {__brand?: \\"url\\"}
      /**
       * @default nextval('print_types.photos_id_seq'::regclass)
       */
      id?: number & {readonly __brand?: 'photos_id'}
      metadata: unknown
      owner_user_id: User['id']
    }
    export type {Photos_InsertParameters}
    ",
        "filename": "photos.ts",
      },
      Object {
        "content": "interface User {
      age: (number) | null
      bio: (string) | null
      /**
       * @default nextval('print_types.users_id_seq'::regclass)
       */
      id: number & {readonly __brand?: 'users_id'}
      screen_name: string
    }
    export default User;

    interface Users_InsertParameters {
      age?: (number) | null
      bio?: (string) | null
      /**
       * @default nextval('print_types.users_id_seq'::regclass)
       */
      id?: number & {readonly __brand?: 'users_id'}
      screen_name: string
    }
    export type {Users_InsertParameters}
    ",
        "filename": "users.ts",
      },
    ]
  `);
});
