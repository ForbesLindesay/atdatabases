import {DEFAULT_CONFIG} from '@databases/pg-config/src';
import getSchema, {connect, sql} from '@databases/pg-schema-introspect';
import PrintContext from '../PrintContext';
import getTypeScriptType from '../getTypeScriptType';
import PrintOptions from '../PrintOptions';
import printSchema from '../printers/printSchema';
import writeFiles from '../writeFiles';
import PgDataTypeID from '@databases/pg-data-type-id/src';

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
      ...DEFAULT_CONFIG.types,
      columnTypeOverrides: {
        'photos.cdn_url': 'string & {__brand?: "url"}',
      },
      typeOverrides: {
        [PgDataTypeID.jsonb]: 'unknown',
      },
    }),
  );
  printSchema(schema, printContext);
  await writeFiles(printContext, __dirname);

  expect(printContext.getFiles()).toMatchInlineSnapshot(`
    Array [
      Object {
        "content": "import Photos, {Photos_InsertParameters} from './photos'
    import Users, {Users_InsertParameters} from './users'

    interface DatabaseSchema {
      photos: {record: Photos, insert: Photos_InsertParameters};
      users: {record: Users, insert: Users_InsertParameters};
    }
    export default DatabaseSchema;
    ",
        "filename": "index.ts",
      },
      Object {
        "content": "import Users from './users'

    interface Photos {
      caption: (string) | null
      cdn_url: string & {__brand?: \\"url\\"}
      id: number & {readonly __brand?: 'photos_id'}
      metadata: unknown
      owner_user_id: Users['id']
    }
    export default Photos;

    interface Photos_InsertParameters {
      caption?: (string) | null
      cdn_url: string & {__brand?: \\"url\\"}
      id?: number & {readonly __brand?: 'photos_id'}
      metadata: unknown
      owner_user_id: Users['id']
    }
    export {Photos_InsertParameters}
    ",
        "filename": "photos.ts",
      },
      Object {
        "content": "interface Users {
      age: (number) | null
      bio: (string) | null
      id: number & {readonly __brand?: 'users_id'}
      screen_name: string
    }
    export default Users;

    interface Users_InsertParameters {
      age?: (number) | null
      bio?: (string) | null
      id?: number & {readonly __brand?: 'users_id'}
      screen_name: string
    }
    export {Users_InsertParameters}
    ",
        "filename": "users.ts",
      },
    ]
  `);
});
