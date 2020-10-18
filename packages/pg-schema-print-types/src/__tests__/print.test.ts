import getSchema, {connect, sql} from '@databases/pg-schema-introspect';
import PrintContext from '../PrintContext';
import getTypeScriptType from '../getTypeScriptType';
import {DomainTypeMode} from '../printers/printDomainType';
import {EnumTypeMode} from '../printers/printEnumType';
import printClassDetails, {PrimaryKeyMode} from '../printers/printClassDetails';

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
        caption TEXT NULL
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

  const printContext = new PrintContext(getTypeScriptType, schema, {
    domainTypeMode: DomainTypeMode.StrictBrand,
    enumTypeMode: EnumTypeMode.UnionAlias,
    primaryKeyMode: PrimaryKeyMode.StrictBrand,
    resolveFilename(file) {
      return `${file.name}.ts`;
    },
  });

  for (const cls of schema.classes) {
    printClassDetails(cls, printContext);
  }

  expect(printContext.getFiles()).toMatchInlineSnapshot(`
    Array [
      Object {
        "content": "import {users_DatabaseRecord} from '../users'

    export interface photos_DatabaseRecord {
      caption: string | null
      cdn_url: string
      id: photos_id
      owner_user_id: users_DatabaseRecord['id']
    }

    export type photos_id = number & {readonly __brand: 'photos_id'}

    export interface photos_InsertParameters {
      caption?: string | null
      cdn_url: string
      id?: photos_id
      owner_user_id: users_DatabaseRecord['id']
    }
    ",
        "filename": "photos.ts",
      },
      Object {
        "content": "export interface users_DatabaseRecord {
      age: number | null
      bio: string | null
      id: users_id
      screen_name: string
    }

    export type users_id = number & {readonly __brand: 'users_id'}

    export interface users_InsertParameters {
      age?: number | null
      bio?: string | null
      id?: users_id
      screen_name: string
    }
    ",
        "filename": "users.ts",
      },
      Object {
        "content": "export interface view_a_DatabaseRecord {
      age: number | null
      bio: string | null
      id: number | null
      screen_name: string | null
    }

    export interface view_a_InsertParameters {
      age?: number | null
      bio?: string | null
      id?: number | null
      screen_name?: string | null
    }
    ",
        "filename": "view_a.ts",
      },
      Object {
        "content": "export interface view_b_DatabaseRecord {
      caption: string | null
      cdn_url: string | null
      id: number | null
      owner_user_id: number | null
    }

    export interface view_b_InsertParameters {
      caption?: string | null
      cdn_url?: string | null
      id?: number | null
      owner_user_id?: number | null
    }
    ",
        "filename": "view_b.ts",
      },
    ]
  `);
});
