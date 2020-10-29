import connect, {sql, DataTypeID} from '@databases/pg';
import getTypes from '../getTypes';
import TypeCateogry from '../enums/TypeCategory';
import {readFileSync, writeFileSync} from 'fs';
import TypeKind from '../enums/TypeKind';
const prettier = require('prettier');

const db = connect();

afterAll(async () => {
  await db.dispose();
});

const PG_DATA_TYPE_FILENAME = `${__dirname}/../../../pg-data-type-id/src/index.ts`;
const DEFAULT_TYPESCRIPT_MAPPING_FILENAME = `${__dirname}/../../../pg-schema-print-types/src/DefaultTypeScriptMapping.ts`;

// int8 default for pg-promise is string
// but @databases/pg uses number

const INTERVAL =
  '{years: number,months: number,days: number,hours: number,minutes: number,seconds: number,milliseconds: number, toPostgres: () => string, toISO: () => string}';

const typeMappings: {[key in DataTypeID]?: string} = {
  [DataTypeID.bool]: 'boolean',
  [DataTypeID.bytea]: 'Buffer',
  [DataTypeID.circle]: '{x: number, y: number, radius: number}',
  [DataTypeID.float4]: 'number',
  [DataTypeID.int2]: 'number',
  [DataTypeID.int8]: 'number',
  [DataTypeID.interval]: INTERVAL,
  [DataTypeID.json]: 'any',
  [DataTypeID.jsonb]: 'any',
  [DataTypeID.point]: '{x: number, y: number}',
  [DataTypeID.timestamp]: 'Date',
  [DataTypeID._bool]: 'Array<boolean | nul>',
  [DataTypeID._bytea]: 'Array<Buffer | null>',
  [DataTypeID._int2]: 'Array<number | null>',
  [DataTypeID._int8]: 'Array<number | null>',
  [DataTypeID._interval]: `Array<${INTERVAL} | null>`,
  [DataTypeID._json]: 'Array<any | null>',
  [DataTypeID._numeric]: 'Array<number | null>',
  [DataTypeID._point]: 'Array<{x: number, y: number} | null>',
  [DataTypeID._text]: 'Array<string | null>',
  [DataTypeID._timestamp]: 'Array<Date | null>',
};

async function writeIfDifferent(filename: string, content: string) {
  const prettierOptions = (await prettier.resolveConfig(filename)) || {};
  prettierOptions.parser = 'typescript';
  const formatted = prettier.format(content, prettierOptions);
  let currentContent = '';
  try {
    currentContent = readFileSync(filename, 'utf8');
    if (currentContent === formatted) {
      return;
    }
  } catch (ex) {
    if (ex.code !== 'ENOENT') throw ex;
  }
  if (process.env.CI) {
    expect(formatted).toEqual(currentContent);
  }
  writeFileSync(filename, formatted);
}

test('get built in types', async () => {
  const builtInTypes = (await getTypes(db, {schemaName: 'pg_catalog'}))
    .filter(
      (t) => !t.typeName.startsWith('pg_') && !t.typeName.startsWith('_pg_'),
    )
    .map((t) => ({
      kind: t.kind,
      typeID: t.typeID,
      typeName: t.typeName,
      category: t.category,
      comment: t.comment,
      ...('subtypeName' in t ? {subtypeName: t.subtypeName} : {}),
    }));
  for (const t of [
    {
      kind: TypeKind.Array,
      typeID: 1023,
      typeName: '_abstime',
      subtypeName: 'abstime',
      category: TypeCateogry.Array,
      comment: null,
    },
    {
      kind: TypeKind.Array,
      typeID: 4073,
      typeName: '_jsonpath',
      subtypeName: 'jsonpath',
      category: TypeCateogry.Array,
      comment: null,
    },
    {
      kind: TypeKind.Array,
      typeID: 4192,
      typeName: '_regcollation',
      subtypeName: 'regcollation',
      category: TypeCateogry.Array,
      comment: null,
    },
    {
      kind: TypeKind.Array,
      typeID: 1024,
      typeName: '_reltime',
      subtypeName: 'reltime',
      category: TypeCateogry.Array,
      comment: null,
    },
    {
      kind: TypeKind.Array,
      typeID: 1025,
      typeName: '_tinterval',
      subtypeName: 'tinterval',
      category: TypeCateogry.Array,
      comment: null,
    },
    {
      kind: TypeKind.Array,
      typeID: 271,
      typeName: '_xid8',
      subtypeName: 'xid8',
      category: TypeCateogry.Array,
      comment: null,
    },
    {
      kind: TypeKind.Base,
      typeID: 702,
      typeName: 'abstime',
      category: TypeCateogry.DateTime,
      comment: 'absolute, limited-range date and time (Unix system time)',
    },
    {
      kind: TypeKind.Pseudo,
      typeID: 5077,
      typeName: 'anycompatible',
      category: TypeCateogry.PseudoTypes,
      comment: 'pseudo-type representing a polymorphic common type',
    },
    {
      kind: TypeKind.Pseudo,
      typeID: 5078,
      typeName: 'anycompatiblearray',
      category: TypeCateogry.PseudoTypes,
      comment:
        'pseudo-type representing an array of polymorphic common type elements',
    },
    {
      kind: TypeKind.Pseudo,
      typeID: 5079,
      typeName: 'anycompatiblenonarray',
      category: TypeCateogry.PseudoTypes,
      comment:
        'pseudo-type representing a polymorphic common type that is not an array',
    },
    {
      kind: TypeKind.Pseudo,
      typeID: 5080,
      typeName: 'anycompatiblerange',
      category: TypeCateogry.PseudoTypes,
      comment:
        'pseudo-type representing a range over a polymorphic common type',
    },
    {
      kind: TypeKind.Pseudo,
      typeID: 2282,
      typeName: 'opaque',
      category: TypeCateogry.PseudoTypes,
      comment: null,
    },
    {
      kind: TypeKind.Pseudo,
      typeID: 269,
      typeName: 'table_am_handler',
      category: TypeCateogry.PseudoTypes,
      comment: null,
    },
    {
      kind: TypeKind.Base,
      typeID: 703,
      typeName: 'reltime',
      category: TypeCateogry.Timespan,
      comment: 'relative, limited-range time interval (Unix delta time)',
    },
    {
      kind: TypeKind.Base,
      typeID: 704,
      typeName: 'tinterval',
      category: TypeCateogry.Timespan,
      comment: '(abstime,abstime), time interval',
    },
    {
      kind: TypeKind.Base,
      typeID: 4072,
      typeName: 'jsonpath',
      category: TypeCateogry.UserDefined,
      comment: 'JSON path',
    },
    {
      kind: TypeKind.Base,
      typeID: 210,
      typeName: 'smgr',
      category: TypeCateogry.UserDefined,
      comment: 'storage manager',
    },
    {
      kind: TypeKind.Base,
      typeID: 5069,
      typeName: 'xid8',
      category: TypeCateogry.UserDefined,
      comment: 'full transaction id',
    },
    {
      kind: TypeKind.Base,
      typeID: 4191,
      typeName: 'regcollation',
      category: TypeCateogry.Numeric,
      comment: 'registered collation',
    },
  ]) {
    if (
      !builtInTypes.some((existingT) => {
        if (existingT.typeID === t.typeID) {
          expect({
            kind: t.kind,
            typeID: t.typeID,
            typeName: t.typeName,
            category: t.category,
            comment: t.comment || '',
          }).toEqual({
            kind: existingT.kind,
            typeID: existingT.typeID,
            typeName: existingT.typeName,
            category: existingT.category,
            comment: existingT.comment || '',
          });
          return true;
        }
        return false;
      })
    ) {
      builtInTypes.push(t);
    }
  }

  builtInTypes.sort((a, b) => (a.typeName > b.typeName ? 1 : -1));

  const groupedTypes = builtInTypes.reduce<{
    [key: string]: typeof builtInTypes[number][];
  }>((result, ty) => {
    const category = Object.keys(TypeCateogry).find(
      (c) => (TypeCateogry as any)[c] === ty.category,
    )!;
    result[category] = (result[category] || []).concat([ty]);
    return result;
  }, {});
  expect(
    Object.keys(groupedTypes)
      .sort()
      .reduce<{[key: string]: string[]}>((result, key) => {
        return {
          ...result,
          [key]: groupedTypes[key].map(
            (ty) =>
              `${ty.typeID} = ${ty.typeName}` +
              ('subtypeName' in ty && ty.subtypeName
                ? `<${ty.subtypeName}>`
                : ''),
          ),
        };
      }, {}),
  ).toMatchSnapshot();

  const PgDataTypeIDsEnum = [
    '// auto generated by test suite of pg-schema-introspect',
    '',
    'enum PgDataTypeID {',
  ];
  Object.keys(groupedTypes).forEach((groupName, i) => {
    if (i !== 0) PgDataTypeIDsEnum.push('');
    PgDataTypeIDsEnum.push(`  // === ${groupName} ===`);
    groupedTypes[groupName].forEach((type) => {
      PgDataTypeIDsEnum.push('');
      const commentLines = [];
      if (type.comment) {
        commentLines.push(type.comment);
      }
      if (type.kind === TypeKind.Array) {
        commentLines.push(`Array<${type.subtypeName}>`);
      }
      if (commentLines.length) {
        PgDataTypeIDsEnum.push(`  /**`);
        commentLines.forEach((commentLine, j) => {
          if (j !== 0) {
            PgDataTypeIDsEnum.push(`   *`);
          }
          PgDataTypeIDsEnum.push(`   * ${commentLine}`);
        });
        PgDataTypeIDsEnum.push(`   */`);
      }
      PgDataTypeIDsEnum.push(`  ${type.typeName} = ${type.typeID},`);
    });
  });
  PgDataTypeIDsEnum.push(`}`);
  PgDataTypeIDsEnum.push(``);
  PgDataTypeIDsEnum.push(`export default PgDataTypeID;`);
  PgDataTypeIDsEnum.push(`module.exports = PgDataTypeID;`);
  PgDataTypeIDsEnum.push(`module.exports.default = PgDataTypeID;`);
  PgDataTypeIDsEnum.push(``);
  await writeIfDifferent(PG_DATA_TYPE_FILENAME, PgDataTypeIDsEnum.join('\n'));

  const pgTypes = require('pg-types/lib/textParsers');
  const mapping = new Map<number, unknown>();
  const reverseMapping = new Map<unknown, number[]>();
  pgTypes.init((id: number, parser: unknown) => {
    mapping.set(id, parser);
    const m = reverseMapping.get(parser) || [];
    reverseMapping.set(parser, [...m, id]);
  });
  const typeMappingLines: string[] = [];
  mapping.forEach((parser, id) => {
    const allIDs = reverseMapping.get(parser) || [];
    const idsWithMapping = allIDs.filter((typeID) => typeID in typeMappings);
    if (idsWithMapping.length === 0) {
      throw new Error(
        'There is no mapping for: ' +
          allIDs.map((typeID) => DataTypeID[typeID]).join(', '),
      );
    }
    if (idsWithMapping.length > 1) {
      throw new Error(
        'There is ambiguity between: ' +
          idsWithMapping.map((typeID) => DataTypeID[typeID]).join(', '),
      );
    }
    typeMappingLines.push(
      `  [DataTypeID.${DataTypeID[id]}, '${
        (typeMappings as any)[idsWithMapping[0]]
      }'],`,
    );
  });
  const DefaultTypeScriptMapping = [
    '// auto generated by test suite of pg-schema-introspect',
    ``,
    `import DataTypeID from '@databases/pg-data-type-id';`,
    ``,
    `const DefaultTypeScriptMapping = new Map([`,
    ...typeMappingLines.sort(),
    `]);`,
    ``,
    `export default DefaultTypeScriptMapping;`,
  ];
  await writeIfDifferent(
    DEFAULT_TYPESCRIPT_MAPPING_FILENAME,
    DefaultTypeScriptMapping.join('\n'),
  );
});

test('get custom types', async () => {
  await db.query(sql`CREATE SCHEMA gettypes`);
  await db.query(
    sql`
      CREATE TYPE gettypes.currency AS ENUM('USD', 'GBP');
      COMMENT ON TYPE gettypes.currency IS 'Three character currency code';

      CREATE DOMAIN gettypes.email AS TEXT CHECK (VALUE ~ '^.+@.+$');
      COMMENT ON TYPE gettypes.email IS 'An email address';

      CREATE TYPE gettypes.money_with_currency AS (
        value MONEY,
        currency gettypes.currency
      );
      COMMENT ON TYPE gettypes.money_with_currency IS 'A monetary value with currency';
    `,
  );
  await db.query(
    sql`
      CREATE TABLE gettypes.tab (
        email gettypes.email NOT NULL PRIMARY KEY,
        money gettypes.money_with_currency
      );
    `,
  );
  await db.query(
    sql`
      INSERT INTO gettypes.tab (email, money) VALUES (${'forbes@lindesay.co.uk'}, ROW (${10}, 'USD'))
    `,
  );
  expect(await db.query(sql`SELECT * FROM gettypes.tab`))
    .toMatchInlineSnapshot(`
    Array [
      Object {
        "email": "forbes@lindesay.co.uk",
        "money": "($10.00,USD)",
      },
    ]
  `);
  expect(
    (await getTypes(db, {schemaName: 'gettypes'}))
      .map((t) => {
        const result = {
          ...t,
          schemaID: typeof t.schemaID === 'number' ? '<oid>' : t.schemaID,
          typeID: typeof t.typeID === 'number' ? '<oid>' : t.typeID,
        };
        if ('subtypeID' in result && typeof result.subtypeID === 'number') {
          result.subtypeID = '<oid>' as any;
        }
        if ('basetypeID' in result && typeof result.basetypeID === 'number') {
          result.basetypeID = '<oid>' as any;
        }
        if ('classID' in result && typeof result.classID === 'number') {
          result.classID = '<oid>' as any;
        }
        if ('attributes' in result) {
          result.attributes = result.attributes.map((a) => ({
            ...a,
            classID: typeof a.classID === 'number' ? '<oid>' : a.classID,
            schemaID: typeof a.schemaID === 'number' ? '<oid>' : a.schemaID,
            typeID: typeof a.typeID === 'number' ? '<oid>' : a.typeID,
          })) as any[];
        }
        return result;
      })
      .filter((t) => {
        // newer versions of postgres include this, but we need the tests to continue
        // passing on postgres 10.14 for now.
        return t.typeName !== '_email';
      }),
  ).toMatchInlineSnapshot(`
    Array [
      Object {
        "category": "A",
        "comment": null,
        "kind": "array",
        "schemaID": "<oid>",
        "schemaName": "gettypes",
        "subtypeID": "<oid>",
        "subtypeName": "currency",
        "typeID": "<oid>",
        "typeName": "_currency",
      },
      Object {
        "category": "A",
        "comment": null,
        "kind": "array",
        "schemaID": "<oid>",
        "schemaName": "gettypes",
        "subtypeID": "<oid>",
        "subtypeName": "money_with_currency",
        "typeID": "<oid>",
        "typeName": "_money_with_currency",
      },
      Object {
        "category": "A",
        "comment": null,
        "kind": "array",
        "schemaID": "<oid>",
        "schemaName": "gettypes",
        "subtypeID": "<oid>",
        "subtypeName": "tab",
        "typeID": "<oid>",
        "typeName": "_tab",
      },
      Object {
        "category": "E",
        "comment": "Three character currency code",
        "kind": "e",
        "schemaID": "<oid>",
        "schemaName": "gettypes",
        "typeID": "<oid>",
        "typeName": "currency",
        "values": Array [
          "GBP",
          "USD",
        ],
      },
      Object {
        "basetypeID": "<oid>",
        "basetypeName": "text",
        "category": "S",
        "comment": "An email address",
        "kind": "d",
        "schemaID": "<oid>",
        "schemaName": "gettypes",
        "typeID": "<oid>",
        "typeName": "email",
      },
      Object {
        "attributes": Array [
          Object {
            "attributeName": "currency",
            "attributeNumber": 2,
            "classID": "<oid>",
            "className": "money_with_currency",
            "comment": null,
            "default": null,
            "hasDefault": false,
            "notNull": false,
            "schemaID": "<oid>",
            "schemaName": "gettypes",
            "typeID": "<oid>",
            "typeLength": -1,
          },
          Object {
            "attributeName": "value",
            "attributeNumber": 1,
            "classID": "<oid>",
            "className": "money_with_currency",
            "comment": null,
            "default": null,
            "hasDefault": false,
            "notNull": false,
            "schemaID": "<oid>",
            "schemaName": "gettypes",
            "typeID": "<oid>",
            "typeLength": -1,
          },
        ],
        "category": "C",
        "classID": "<oid>",
        "comment": "A monetary value with currency",
        "kind": "c",
        "schemaID": "<oid>",
        "schemaName": "gettypes",
        "typeID": "<oid>",
        "typeName": "money_with_currency",
      },
      Object {
        "attributes": Array [
          Object {
            "attributeName": "email",
            "attributeNumber": 1,
            "classID": "<oid>",
            "className": "tab",
            "comment": null,
            "default": null,
            "hasDefault": false,
            "notNull": true,
            "schemaID": "<oid>",
            "schemaName": "gettypes",
            "typeID": "<oid>",
            "typeLength": -1,
          },
          Object {
            "attributeName": "money",
            "attributeNumber": 2,
            "classID": "<oid>",
            "className": "tab",
            "comment": null,
            "default": null,
            "hasDefault": false,
            "notNull": false,
            "schemaID": "<oid>",
            "schemaName": "gettypes",
            "typeID": "<oid>",
            "typeLength": -1,
          },
        ],
        "category": "C",
        "classID": "<oid>",
        "comment": null,
        "kind": "c",
        "schemaID": "<oid>",
        "schemaName": "gettypes",
        "typeID": "<oid>",
        "typeName": "tab",
      },
    ]
  `);
});
