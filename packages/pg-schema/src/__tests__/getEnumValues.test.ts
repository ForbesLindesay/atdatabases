import connect, {sql} from '@databases/pg';
import getEnumValues from '../getEnumValues';

const db = connect();

test('get custom types', async () => {
  await db.query(sql`CREATE SCHEMA getenumvalues`);
  await db.query(
    sql`
      CREATE TYPE getenumvalues.kind AS ENUM('FirstKind', 'SecondKind');
      COMMENT ON TYPE getenumvalues.kind IS 'There are two kinds of thing';
    `,
  );
  expect(
    (await getEnumValues(db, {schemaName: 'getenumvalues'})).map((v) => ({
      ...v,
      schemaID: typeof v.schemaID === 'number' ? '<oid>' : v.schemaID,
      typeID: typeof v.typeID === 'number' ? '<oid>' : v.typeID,
    })),
  ).toMatchInlineSnapshot(`
Array [
  Object {
    "schemaID": "<oid>",
    "schemaName": "getenumvalues",
    "typeID": "<oid>",
    "typeName": "kind",
    "value": "FirstKind",
  },
  Object {
    "schemaID": "<oid>",
    "schemaName": "getenumvalues",
    "typeID": "<oid>",
    "typeName": "kind",
    "value": "SecondKind",
  },
]
`);
});
