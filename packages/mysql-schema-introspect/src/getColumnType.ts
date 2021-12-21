import * as t from 'funtypes';
import DataType from './enums/DataType';

const IntegerSchema = t.Number.withConstraint(
  (value) =>
    value !== Math.floor(value) ||
    Number.isNaN(value) ||
    value > Number.MAX_SAFE_INTEGER ||
    value < Number.MIN_SAFE_INTEGER
      ? `Expected an integer but got ${value.toString()}`
      : true,
  {name: `Integer`},
);
const aliases = new Map<string | DataType, DataType>([
  [`geometrycollection`, DataType.geomcollection],
]);
const SimpleColumnTypeSchema = t.Named(
  `SimpleColumnType`,
  t.Object({
    kind: t.Union(
      t.Literal(DataType.bigint),
      t.Literal(DataType.blob),
      t.Literal(DataType.date),
      t.Literal(DataType.datetime),
      t.Literal(DataType.double),
      t.Literal(DataType.float),
      t.Literal(DataType.geometry),
      t.Literal(DataType.geomcollection),
      t.Literal(DataType.int),
      t.Literal(DataType.json),
      t.Literal(DataType.linestring),
      t.Literal(DataType.longblob),
      t.Literal(DataType.longtext),
      t.Literal(DataType.mediumblob),
      t.Literal(DataType.mediumint),
      t.Literal(DataType.mediumtext),
      t.Literal(DataType.multilinestring),
      t.Literal(DataType.multipoint),
      t.Literal(DataType.multipolygon),
      t.Literal(DataType.point),
      t.Literal(DataType.polygon),
      t.Literal(DataType.smallint),
      t.Literal(DataType.text),
      t.Literal(DataType.time),
      t.Literal(DataType.timestamp),
      t.Literal(DataType.tinyblob),
      t.Literal(DataType.tinyint),
      t.Literal(DataType.tinytext),
      t.Literal(DataType.year),
    ),
  }),
);
export type SimpleColumnType = t.Static<typeof SimpleColumnTypeSchema>;
const DecimalTypeSchema = t.Named(
  `DecimalType`,
  t.Object({
    kind: t.Literal(DataType.decimal),
    /**
     * aka "numeric_precision"
     */
    digits: IntegerSchema,
    /**
     * aka "numeric_scale"
     */
    decimals: IntegerSchema,
  }),
);
export type DecimalType = t.Static<typeof DecimalTypeSchema>;

const EnumTypeSchema = t.Named(
  `Enum`,
  t.Object({
    kind: t.Literal(DataType.enum),
    values: t.Array(t.String),
  }),
);
export type EnumType = t.Static<typeof EnumTypeSchema>;
const SetTypeSchema = t.Named(
  `Set`,
  t.Object({
    kind: t.Literal(DataType.set),
    values: t.Array(t.String),
  }),
);
export type SetType = t.Static<typeof SetTypeSchema>;
const ColumnTypeWithLengthSchema = t.Named(
  `ColumnTypeWithLength`,
  t.Object({
    kind: t.Union(
      t.Literal(DataType.binary),
      t.Literal(DataType.bit),
      t.Literal(DataType.char),
      t.Literal(DataType.varbinary),
      t.Literal(DataType.varchar),
    ),
    length: IntegerSchema,
  }),
);
export type ColumnTypeWithLength = t.Static<typeof ColumnTypeWithLengthSchema>;

export const ColumnTypeSchema = t.Union(
  SimpleColumnTypeSchema,
  DecimalTypeSchema,
  EnumTypeSchema,
  SetTypeSchema,
  ColumnTypeWithLengthSchema,
);
export type ColumnType = t.Static<typeof ColumnTypeSchema>;

export default function getColumnType(column: {
  data_type: DataType;
  column_type: string;
  character_maximum_length: number;
  numeric_precision: number;
  numeric_scale: number;
}): ColumnType {
  const alias = aliases.get(column.data_type);
  if (alias) {
    return getColumnType({...column, data_type: alias});
  }
  return ColumnTypeSchema.parse(getColumnTypeInternal(column));
}

function getColumnTypeInternal(column: {
  data_type: DataType;
  column_type: string;
  character_maximum_length: number;
  numeric_precision: number;
  numeric_scale: number;
}): ColumnType {
  switch (column.data_type) {
    case DataType.binary:
    case DataType.char:
    case DataType.varbinary:
    case DataType.varchar:
      if (!IntegerSchema.test(column.character_maximum_length)) {
        throw new Error(
          `Missing column.character_maximum_length for ${column.data_type}`,
        );
      }
      return {kind: column.data_type, length: column.character_maximum_length};
    case DataType.bit:
      if (!IntegerSchema.test(column.numeric_precision)) {
        throw new Error(
          `Missing column.numeric_precision for ${
            column.data_type
          }: ${JSON.stringify(column)}`,
        );
      }
      return {
        kind: column.data_type,
        length: column.numeric_precision,
      };

    case DataType.decimal:
      const match = /^decimal\((\d+),(\d+)\)/.exec(column.column_type);
      if (!match) {
        throw new Error(
          `Missing precision for ${column.data_type}: ${JSON.stringify(
            column,
          )}`,
        );
      }
      return {
        kind: column.data_type,
        digits: parseInt(match[1], 10),
        decimals: parseInt(match[2], 10),
      };
    case DataType.enum:
      return {
        kind: column.data_type,
        values: parseValuesList(column.column_type.substring(`enum`.length)),
      };
    case DataType.set:
      return {
        kind: column.data_type,
        values: parseValuesList(column.column_type.substring(`set`.length)),
      };

    // case DataType.bigint:
    // case DataType.int:
    // case DataType.mediumint:
    // case DataType.smallint:
    // case DataType.tinyint:
    // case DataType.year:
    //   return {kind: column.data_type};
    default:
      // if (column.data_type !== column.column_type) {
      //   throw new Error(`Unexpected column format: ${JSON.stringify(column)}`);
      // }
      return {kind: column.data_type};
  }
}

function parseValuesList(input: string): string[] {
  const result: string[] = [];
  let rest = input.substring(1);
  let state: 'default' | 'in_string' | 'found_quote' | 'in_list' = 'default';
  let current = '';
  while (rest) {
    switch (state) {
      case 'default':
        if (!rest.startsWith(`'`)) {
          throw new Error(
            `Invalid values list: "${input}", expected "'" but got "${rest}"`,
          );
        }
        rest = rest.substring(1);
        state = 'in_string';
        break;
      case 'in_string':
        if (rest.startsWith(`'`)) {
          state = 'found_quote';
          rest = rest.substring(1);
        } else {
          current += rest[0];
          rest = rest.substring(1);
        }
        break;
      case 'found_quote':
        if (rest.startsWith(`'`)) {
          state = 'in_string';
          current += `'`;
          rest = rest.substring(1);
        } else {
          state = 'in_list';
          result.push(current);
          current = '';
        }
        break;
      case 'in_list':
        if (rest.startsWith(`)`)) {
          return result;
        }
        if (!rest.startsWith(`,'`)) {
          throw new Error(`Invalid values list: "${input}"`);
        }
        rest = rest.substring(1);
        state = 'default';
        break;
    }
  }
  throw new Error(`Invalid values list: "${input}"`);
}
