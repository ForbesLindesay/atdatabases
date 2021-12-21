import connect, {sql} from '@databases/mysql';
import {readFileSync, writeFileSync} from 'fs';
import {DataType} from '..';
import getColumns from '../getColumns';

const db = connect({bigIntMode: 'number'});

// JSON added in 5.7
const SUPPORTS_JSON_TYPE = !process.env.MYSQL_TEST_IMAGE?.includes(`:5.6`);

// Older versions of MySQL give `timestamp` columns a default value of `CURRENT_TIMESTAMP` and
// make them non nullable by default.
const SUPPORTS_MODERN_TIMESTAMP = !process.env.MYSQL_TEST_IMAGE?.includes(`:5`);

const TYPE_NAMES = [
  'TINYINT',
  'SMALLINT',
  'MEDIUMINT',
  'INT',
  'BIGINT',
  'DECIMAL',
  'NUMERIC',
  'FLOAT',
  'DOUBLE',
  'BIT',
  'DATE',
  'DATETIME',
  'TIMESTAMP',
  'TIME',
  'YEAR',
  'CHAR',
  'VARCHAR',
  'BINARY',
  'VARBINARY',
  'TINYBLOB',
  'BLOB',
  'MEDIUMBLOB',
  'LONGBLOB',
  'TINYTEXT',
  'TEXT',
  'MEDIUMTEXT',
  'LONGTEXT',
  'ENUM',
  'SET',
  'GEOMETRY',
  'POINT',
  'LINESTRING',
  'POLYGON',
  'MULTIPOINT',
  'MULTILINESTRING',
  'MULTIPOLYGON',
  'GEOMETRYCOLLECTION',
  ...(SUPPORTS_JSON_TYPE ? ['JSON'] : []),
];

const TYPE_NAMES_WITH_TWO_LENGTHS = ['DECIMAL', 'NUMERIC'];
const TYPE_NAMES_WITH_LENGTH = ['VARCHAR', 'VARBINARY'];
const TYPE_NAMES_WITH_VALUES = ['ENUM', 'SET'];

// Newer versions of MySQL have renamed some types
const aliases = new Map([[`geometrycollection`, `geomcollection`]]);
function getSuffix(typeName: string) {
  if (TYPE_NAMES_WITH_TWO_LENGTHS.includes(typeName)) {
    return `(10,5)`;
  }
  if (TYPE_NAMES_WITH_LENGTH.includes(typeName)) {
    return `(32)`;
  }
  if (TYPE_NAMES_WITH_VALUES.includes(typeName)) {
    return `('small', 'medium', "large", 'Forbes\\'s\\tSize')`;
  }
  return ``;
}

test('column-types', async () => {
  await db.query(
    sql`
      CREATE TABLE column_types_test (
        ${sql.join(
          TYPE_NAMES.map((typeName) =>
            sql.__dangerous__rawValue(
              `val_${typeName.toLowerCase()} ${typeName}${getSuffix(typeName)}`,
            ),
          ),
          sql`,\n  `,
        )}
      );
    `,
  );

  const dataTypeRows = await db.query(sql`
    SELECT DATA_TYPE as "data_type"
    FROM INFORMATION_SCHEMA.COLUMNS
  `);
  const dataTypes = new Set([
    ...dataTypeRows.map(
      (d: any): string => aliases.get(d.data_type) ?? d.data_type,
    ),
    ...Object.values(DataType),
  ]);
  const actualString = `enum DataType {\n${[...dataTypes]
    .sort()
    .map((dt) => `  ${dt} = '${dt}',`)
    .join(`\n`)}\n}\nexport default DataType;\n`;
  const expectedString = readFileSync(
    `${__dirname}/../enums/DataType.ts`,
    `utf8`,
  );
  if (process.env.CI) {
    expect(actualString).toBe(expectedString);
  } else if (actualString !== expectedString) {
    writeFileSync(`${__dirname}/../enums/DataType.ts`, actualString);
  }

  let columns = await getColumns(db, {
    schemaName: 'test-db',
    tableName: `column_types_test`,
  });
  if (SUPPORTS_JSON_TYPE) {
    expect(columns.find((c) => c.columnName === `val_json`))
      .toMatchInlineSnapshot(`
      Object {
        "columnName": "val_json",
        "comment": "",
        "default": null,
        "isNullable": true,
        "isPrimaryKey": false,
        "ordinalPosition": 38,
        "schemaName": "test-db",
        "tableName": "column_types_test",
        "type": Object {
          "kind": "json",
        },
      }
    `);
    columns = columns.filter((c) => c.columnName !== `val_json`);
  }
  if (SUPPORTS_MODERN_TIMESTAMP) {
    expect(columns.find((c) => c.columnName === `val_timestamp`))
      .toMatchInlineSnapshot(`
      Object {
        "columnName": "val_timestamp",
        "comment": "",
        "default": null,
        "isNullable": true,
        "isPrimaryKey": false,
        "ordinalPosition": 13,
        "schemaName": "test-db",
        "tableName": "column_types_test",
        "type": Object {
          "kind": "timestamp",
        },
      }
    `);
  } else {
    expect(columns.find((c) => c.columnName === `val_timestamp`))
      .toMatchInlineSnapshot(`
      Object {
        "columnName": "val_timestamp",
        "comment": "",
        "default": "CURRENT_TIMESTAMP",
        "isNullable": false,
        "isPrimaryKey": false,
        "ordinalPosition": 13,
        "schemaName": "test-db",
        "tableName": "column_types_test",
        "type": Object {
          "kind": "timestamp",
        },
      }
    `);
  }
  columns = columns.filter((c) => c.columnName !== `val_timestamp`);
  expect(columns).toMatchInlineSnapshot(`
    Array [
      Object {
        "columnName": "val_bigint",
        "comment": "",
        "default": null,
        "isNullable": true,
        "isPrimaryKey": false,
        "ordinalPosition": 5,
        "schemaName": "test-db",
        "tableName": "column_types_test",
        "type": Object {
          "kind": "bigint",
        },
      },
      Object {
        "columnName": "val_binary",
        "comment": "",
        "default": null,
        "isNullable": true,
        "isPrimaryKey": false,
        "ordinalPosition": 18,
        "schemaName": "test-db",
        "tableName": "column_types_test",
        "type": Object {
          "kind": "binary",
          "length": 1,
        },
      },
      Object {
        "columnName": "val_bit",
        "comment": "",
        "default": null,
        "isNullable": true,
        "isPrimaryKey": false,
        "ordinalPosition": 10,
        "schemaName": "test-db",
        "tableName": "column_types_test",
        "type": Object {
          "kind": "bit",
          "length": 1,
        },
      },
      Object {
        "columnName": "val_blob",
        "comment": "",
        "default": null,
        "isNullable": true,
        "isPrimaryKey": false,
        "ordinalPosition": 21,
        "schemaName": "test-db",
        "tableName": "column_types_test",
        "type": Object {
          "kind": "blob",
        },
      },
      Object {
        "columnName": "val_char",
        "comment": "",
        "default": null,
        "isNullable": true,
        "isPrimaryKey": false,
        "ordinalPosition": 16,
        "schemaName": "test-db",
        "tableName": "column_types_test",
        "type": Object {
          "kind": "char",
          "length": 1,
        },
      },
      Object {
        "columnName": "val_date",
        "comment": "",
        "default": null,
        "isNullable": true,
        "isPrimaryKey": false,
        "ordinalPosition": 11,
        "schemaName": "test-db",
        "tableName": "column_types_test",
        "type": Object {
          "kind": "date",
        },
      },
      Object {
        "columnName": "val_datetime",
        "comment": "",
        "default": null,
        "isNullable": true,
        "isPrimaryKey": false,
        "ordinalPosition": 12,
        "schemaName": "test-db",
        "tableName": "column_types_test",
        "type": Object {
          "kind": "datetime",
        },
      },
      Object {
        "columnName": "val_decimal",
        "comment": "",
        "default": null,
        "isNullable": true,
        "isPrimaryKey": false,
        "ordinalPosition": 6,
        "schemaName": "test-db",
        "tableName": "column_types_test",
        "type": Object {
          "decimals": 5,
          "digits": 10,
          "kind": "decimal",
        },
      },
      Object {
        "columnName": "val_double",
        "comment": "",
        "default": null,
        "isNullable": true,
        "isPrimaryKey": false,
        "ordinalPosition": 9,
        "schemaName": "test-db",
        "tableName": "column_types_test",
        "type": Object {
          "kind": "double",
        },
      },
      Object {
        "columnName": "val_enum",
        "comment": "",
        "default": null,
        "isNullable": true,
        "isPrimaryKey": false,
        "ordinalPosition": 28,
        "schemaName": "test-db",
        "tableName": "column_types_test",
        "type": Object {
          "kind": "enum",
          "values": Array [
            "small",
            "medium",
            "large",
            "Forbes's	Size",
          ],
        },
      },
      Object {
        "columnName": "val_float",
        "comment": "",
        "default": null,
        "isNullable": true,
        "isPrimaryKey": false,
        "ordinalPosition": 8,
        "schemaName": "test-db",
        "tableName": "column_types_test",
        "type": Object {
          "kind": "float",
        },
      },
      Object {
        "columnName": "val_geometry",
        "comment": "",
        "default": null,
        "isNullable": true,
        "isPrimaryKey": false,
        "ordinalPosition": 30,
        "schemaName": "test-db",
        "tableName": "column_types_test",
        "type": Object {
          "kind": "geometry",
        },
      },
      Object {
        "columnName": "val_geometrycollection",
        "comment": "",
        "default": null,
        "isNullable": true,
        "isPrimaryKey": false,
        "ordinalPosition": 37,
        "schemaName": "test-db",
        "tableName": "column_types_test",
        "type": Object {
          "kind": "geomcollection",
        },
      },
      Object {
        "columnName": "val_int",
        "comment": "",
        "default": null,
        "isNullable": true,
        "isPrimaryKey": false,
        "ordinalPosition": 4,
        "schemaName": "test-db",
        "tableName": "column_types_test",
        "type": Object {
          "kind": "int",
        },
      },
      Object {
        "columnName": "val_linestring",
        "comment": "",
        "default": null,
        "isNullable": true,
        "isPrimaryKey": false,
        "ordinalPosition": 32,
        "schemaName": "test-db",
        "tableName": "column_types_test",
        "type": Object {
          "kind": "linestring",
        },
      },
      Object {
        "columnName": "val_longblob",
        "comment": "",
        "default": null,
        "isNullable": true,
        "isPrimaryKey": false,
        "ordinalPosition": 23,
        "schemaName": "test-db",
        "tableName": "column_types_test",
        "type": Object {
          "kind": "longblob",
        },
      },
      Object {
        "columnName": "val_longtext",
        "comment": "",
        "default": null,
        "isNullable": true,
        "isPrimaryKey": false,
        "ordinalPosition": 27,
        "schemaName": "test-db",
        "tableName": "column_types_test",
        "type": Object {
          "kind": "longtext",
        },
      },
      Object {
        "columnName": "val_mediumblob",
        "comment": "",
        "default": null,
        "isNullable": true,
        "isPrimaryKey": false,
        "ordinalPosition": 22,
        "schemaName": "test-db",
        "tableName": "column_types_test",
        "type": Object {
          "kind": "mediumblob",
        },
      },
      Object {
        "columnName": "val_mediumint",
        "comment": "",
        "default": null,
        "isNullable": true,
        "isPrimaryKey": false,
        "ordinalPosition": 3,
        "schemaName": "test-db",
        "tableName": "column_types_test",
        "type": Object {
          "kind": "mediumint",
        },
      },
      Object {
        "columnName": "val_mediumtext",
        "comment": "",
        "default": null,
        "isNullable": true,
        "isPrimaryKey": false,
        "ordinalPosition": 26,
        "schemaName": "test-db",
        "tableName": "column_types_test",
        "type": Object {
          "kind": "mediumtext",
        },
      },
      Object {
        "columnName": "val_multilinestring",
        "comment": "",
        "default": null,
        "isNullable": true,
        "isPrimaryKey": false,
        "ordinalPosition": 35,
        "schemaName": "test-db",
        "tableName": "column_types_test",
        "type": Object {
          "kind": "multilinestring",
        },
      },
      Object {
        "columnName": "val_multipoint",
        "comment": "",
        "default": null,
        "isNullable": true,
        "isPrimaryKey": false,
        "ordinalPosition": 34,
        "schemaName": "test-db",
        "tableName": "column_types_test",
        "type": Object {
          "kind": "multipoint",
        },
      },
      Object {
        "columnName": "val_multipolygon",
        "comment": "",
        "default": null,
        "isNullable": true,
        "isPrimaryKey": false,
        "ordinalPosition": 36,
        "schemaName": "test-db",
        "tableName": "column_types_test",
        "type": Object {
          "kind": "multipolygon",
        },
      },
      Object {
        "columnName": "val_numeric",
        "comment": "",
        "default": null,
        "isNullable": true,
        "isPrimaryKey": false,
        "ordinalPosition": 7,
        "schemaName": "test-db",
        "tableName": "column_types_test",
        "type": Object {
          "decimals": 5,
          "digits": 10,
          "kind": "decimal",
        },
      },
      Object {
        "columnName": "val_point",
        "comment": "",
        "default": null,
        "isNullable": true,
        "isPrimaryKey": false,
        "ordinalPosition": 31,
        "schemaName": "test-db",
        "tableName": "column_types_test",
        "type": Object {
          "kind": "point",
        },
      },
      Object {
        "columnName": "val_polygon",
        "comment": "",
        "default": null,
        "isNullable": true,
        "isPrimaryKey": false,
        "ordinalPosition": 33,
        "schemaName": "test-db",
        "tableName": "column_types_test",
        "type": Object {
          "kind": "polygon",
        },
      },
      Object {
        "columnName": "val_set",
        "comment": "",
        "default": null,
        "isNullable": true,
        "isPrimaryKey": false,
        "ordinalPosition": 29,
        "schemaName": "test-db",
        "tableName": "column_types_test",
        "type": Object {
          "kind": "set",
          "values": Array [
            "small",
            "medium",
            "large",
            "Forbes's	Size",
          ],
        },
      },
      Object {
        "columnName": "val_smallint",
        "comment": "",
        "default": null,
        "isNullable": true,
        "isPrimaryKey": false,
        "ordinalPosition": 2,
        "schemaName": "test-db",
        "tableName": "column_types_test",
        "type": Object {
          "kind": "smallint",
        },
      },
      Object {
        "columnName": "val_text",
        "comment": "",
        "default": null,
        "isNullable": true,
        "isPrimaryKey": false,
        "ordinalPosition": 25,
        "schemaName": "test-db",
        "tableName": "column_types_test",
        "type": Object {
          "kind": "text",
        },
      },
      Object {
        "columnName": "val_time",
        "comment": "",
        "default": null,
        "isNullable": true,
        "isPrimaryKey": false,
        "ordinalPosition": 14,
        "schemaName": "test-db",
        "tableName": "column_types_test",
        "type": Object {
          "kind": "time",
        },
      },
      Object {
        "columnName": "val_tinyblob",
        "comment": "",
        "default": null,
        "isNullable": true,
        "isPrimaryKey": false,
        "ordinalPosition": 20,
        "schemaName": "test-db",
        "tableName": "column_types_test",
        "type": Object {
          "kind": "tinyblob",
        },
      },
      Object {
        "columnName": "val_tinyint",
        "comment": "",
        "default": null,
        "isNullable": true,
        "isPrimaryKey": false,
        "ordinalPosition": 1,
        "schemaName": "test-db",
        "tableName": "column_types_test",
        "type": Object {
          "kind": "tinyint",
        },
      },
      Object {
        "columnName": "val_tinytext",
        "comment": "",
        "default": null,
        "isNullable": true,
        "isPrimaryKey": false,
        "ordinalPosition": 24,
        "schemaName": "test-db",
        "tableName": "column_types_test",
        "type": Object {
          "kind": "tinytext",
        },
      },
      Object {
        "columnName": "val_varbinary",
        "comment": "",
        "default": null,
        "isNullable": true,
        "isPrimaryKey": false,
        "ordinalPosition": 19,
        "schemaName": "test-db",
        "tableName": "column_types_test",
        "type": Object {
          "kind": "varbinary",
          "length": 32,
        },
      },
      Object {
        "columnName": "val_varchar",
        "comment": "",
        "default": null,
        "isNullable": true,
        "isPrimaryKey": false,
        "ordinalPosition": 17,
        "schemaName": "test-db",
        "tableName": "column_types_test",
        "type": Object {
          "kind": "varchar",
          "length": 32,
        },
      },
      Object {
        "columnName": "val_year",
        "comment": "",
        "default": null,
        "isNullable": true,
        "isPrimaryKey": false,
        "ordinalPosition": 15,
        "schemaName": "test-db",
        "tableName": "column_types_test",
        "type": Object {
          "kind": "year",
        },
      },
    ]
  `);

  await db.dispose();
});
