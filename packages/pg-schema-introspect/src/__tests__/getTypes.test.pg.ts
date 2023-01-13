import connect, {sql, DataTypeID} from '@databases/pg';
import getTypes from '../getTypes';
import TypeCateogry from '../enums/TypeCategory';
import {readFileSync, writeFileSync} from 'fs';
import TypeKind from '../enums/TypeKind';
const prettier = require('prettier');

jest.setTimeout(30_000);

const db = connect({bigIntMode: 'number'});

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
  } catch (ex: any) {
    if (ex.code !== 'ENOENT') throw ex;
  }
  if (process.env.CI) {
    expect(formatted).toEqual(currentContent);
  }
  writeFileSync(filename, formatted);
}

interface BuiltinTypesState {
  types: {
    subtypeName?: string | undefined;
    pgVersion: [number, number];
    kind: TypeKind;
    typeID: number;
    typeName: string;
    category: TypeCateogry;
    comment: string | null;
  }[];
  ambiguousTypes: {
    [name: string]: {
      subtypeName?: string | undefined;
      pgVersion: [number, number];
      kind: TypeKind;
      typeID: number;
      typeName: string;
      category: TypeCateogry;
      comment: string | null;
    }[];
  };
}
async function writeJsonIfDifferent(
  filename: string,
  content: BuiltinTypesState,
) {
  const formatted = JSON.stringify(content, null, '  ');
  let currentContent = '';
  try {
    currentContent = readFileSync(filename, 'utf8');
    if (currentContent === formatted) {
      return;
    }
  } catch (ex: any) {
    if (ex.code !== 'ENOENT') throw ex;
  }
  if (process.env.CI) {
    expect(formatted).toEqual(currentContent);
  }
  writeFileSync(filename, formatted);
}

test('get built in types', async () => {
  const pgVersion = await getPgVersion();
  const builtInTypesFromPg = (await getTypes(db, {schemaName: 'pg_catalog'}))
    .filter((t) => t.kind !== TypeKind.Composite)
    .map((t) => ({
      pgVersion,
      kind: t.kind,
      typeID: t.typeID,
      typeName: t.typeName,
      category: t.category,
      comment: t.comment,
      ...('subtypeName' in t ? {subtypeName: t.subtypeName} : {}),
    }));

  const oldState: BuiltinTypesState = JSON.parse(
    readFileSync(`${__dirname}/builtinTypes.json`, 'utf8'),
  );
  let {types: builtInTypesFromFile} = oldState;
  const {ambiguousTypes} = oldState;
  for (const typeFromPg of builtInTypesFromPg) {
    const ambiguousType = ambiguousTypes[typeFromPg.typeName] || [];
    if (process.env.CI) {
      if (!ambiguousType.length) {
        const typeFromFile = builtInTypesFromFile.find(
          (typeFromFile) => typeFromFile.typeID === typeFromPg.typeID,
        );
        if (typeFromFile) {
          if (typeFromPg.pgVersion[0] >= typeFromFile.pgVersion[0]) {
            expect(typeFromFile).toEqual(typeFromPg);
          }
        } else {
          expect(builtInTypesFromFile).toContainEqual(typeFromPg);
        }
      }
    } else if (ambiguousType.length) {
      let found = false;
      const existingTypes = ambiguousType.filter((t) => {
        if (t.typeID === typeFromPg.typeID) {
          if (lte(t.pgVersion, typeFromPg.pgVersion)) {
            return false;
          } else {
            found = true;
          }
        }
        return true;
      });
      if (!found) {
        ambiguousTypes[typeFromPg.typeName] = sortByPostgresVersion([
          ...existingTypes,
          typeFromPg,
        ]);
      }
    } else {
      // if there are missing types, you can add them by running
      // with PG_TEST_IMAGE=postgres:10.14-alpine (replacing with the relevant version)
      let found = false;
      builtInTypesFromFile = builtInTypesFromFile.filter((typeFromFile) => {
        if (typeFromFile.typeName === typeFromPg.typeName) {
          if (typeFromFile.typeID !== typeFromPg.typeID) {
            found = true;
            ambiguousTypes[typeFromFile.typeName] = sortByPostgresVersion([
              typeFromFile,
              typeFromPg,
            ]);
            return false;
          } else if (lte(typeFromFile.pgVersion, typeFromPg.pgVersion)) {
            return false;
          } else {
            found = true;
          }
        }
        return true;
      });
      if (!found) {
        builtInTypesFromFile.push(typeFromPg);
      }
    }
  }

  builtInTypesFromFile.sort((a, b) => (a.typeName > b.typeName ? 1 : -1));

  await writeJsonIfDifferent(`${__dirname}/builtinTypes.json`, {
    ambiguousTypes,
    types: builtInTypesFromFile,
  });

  const groupedTypes = builtInTypesFromFile.reduce<{
    [key: string]: (typeof builtInTypesFromFile)[number][];
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

async function getPgVersion(): Promise<[number, number]> {
  // e.g. PostgreSQL 10.1 on x86_64-apple-darwin16.7.0, compiled by Apple LLVM version 9.0.0 (clang-900.0.38), 64-bit
  const [{version: sqlVersionString}] = await db.query(
    db.sql`SELECT version();`,
  );
  const match = /PostgreSQL (\d+).(\d+)/.exec(sqlVersionString);
  if (match) {
    const [, major, minor] = match;
    return [parseInt(major, 10), parseInt(minor, 10)];
  }
  return [0, 0];
}

function lte(a: [number, number], b: [number, number]) {
  return a[0] < b[0] || (a[0] === b[0] && (a[1] === b[1] || a[1] < b[1]));
}

function sortByPostgresVersion<T extends {pgVersion: [number, number]}>(
  records: readonly T[],
) {
  return records
    .slice()
    .sort(
      (a, b) =>
        a.pgVersion[0] - b.pgVersion[0] || a.pgVersion[1] - b.pgVersion[1],
    );
}
