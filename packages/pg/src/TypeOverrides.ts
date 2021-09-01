import PgDataTypeID from '@databases/pg-data-type-id';
import PgClient from './types/PgClient';

const {types} = require('pg');

export type ParseFnText = (value: string) => any;
export type ParseFnBinary = (value: Buffer) => any;

export type TypeOverridesFunction = (ctx: {
  getTypeParser(oid: number, format?: 'text'): ParseFnText;
  getTypeParser(type: string, format?: 'text'): Promise<ParseFnText>;

  getTypeParser(oid: number, format: 'binary'): ParseFnBinary;
  getTypeParser(type: string, format: 'binary'): Promise<ParseFnBinary>;

  setTypeParser(oid: number, parseFn: ParseFnText): void;
  setTypeParser(oid: string, parseFn: ParseFnText): Promise<void>;

  setTypeParser(oid: number, format: 'text', parseFn: ParseFnText): void;
  setTypeParser(
    oid: string,
    format: 'text',
    parseFn: ParseFnText,
  ): Promise<void>;

  setTypeParser(oid: number, format: 'binary', parseFn: ParseFnBinary): void;
  setTypeParser(
    oid: string,
    format: 'binary',
    parseFn: ParseFnBinary,
  ): Promise<void>;

  parseComposite: typeof parseComposite;
  parseArray: typeof parseArray;
}) =>
  | undefined
  | TypeOverridesMap
  | TypeOverridesObject
  | Promise<undefined | TypeOverridesMap | TypeOverridesObject>;

export type TypeOverridesMap = {
  forEach(
    callbackfn: (
      value: ParseFnText | [number | PgDataTypeID, ParseFnText],
      key: number | PgDataTypeID,
    ) => void,
  ): void;
};
function isTypeOverridesMap(value: any): value is TypeOverridesMap {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.forEach === 'function'
  );
}

export type TypeOverridesObject = {
  [key in number | PgDataTypeID]?: ParseFnText;
};

export interface TypeOverridesConfig {
  bigIntMode: 'string' | 'number' | 'bigint';
  overrides?: TypeOverridesFunction | TypeOverridesMap | TypeOverridesObject;
}

export default class TypeOverrides {
  private readonly _overrides = {
    text: new Map<number, ParseFnText>(),
    binary: new Map<number, ParseFnBinary>(),
  };

  private readonly _complexOverrides: TypeOverridesConfig['overrides'];
  constructor(config: TypeOverridesConfig) {
    if (config.bigIntMode === 'bigint') {
      this._overrides.binary.set(PgDataTypeID.int8, (value) =>
        value.readBigInt64BE(0),
      );
      this._overrides.text.set(PgDataTypeID.int8, (value) => BigInt(value));
    } else if (config.bigIntMode === 'number') {
      this._overrides.binary.set(PgDataTypeID.int8, (value) =>
        parseInt(value.readBigInt64BE(0).toString(10), 10),
      );
      this._overrides.text.set(PgDataTypeID.int8, (value) =>
        parseInt(value, 10),
      );
    }
    this._complexOverrides = config.overrides;
  }

  async prepareOverrides(resolveTypeID: (typeName: string) => Promise<number>) {
    let overrides: TypeOverridesMap | TypeOverridesObject | undefined;
    if (typeof this._complexOverrides === 'function') {
      overrides = await this._complexOverrides({
        getTypeParser: (type: number | string, ...rest: any[]): any => {
          if (typeof type === 'number') {
            return this.getTypeParser(type, ...rest);
          } else {
            return resolveTypeID(type).then((id) =>
              this.getTypeParser(id, ...rest),
            );
          }
        },
        setTypeParser: (type: number | string, ...rest: any[]): any => {
          if (typeof type === 'number') {
            (this as any).setTypeParser(type, ...rest);
          } else {
            return resolveTypeID(type).then((id) =>
              (this as any).setTypeParser(id, ...rest),
            );
          }
        },
        parseComposite,
        parseArray,
      });
    } else {
      overrides = this._complexOverrides;
    }
    if (isTypeOverridesMap(overrides)) {
      overrides.forEach((value, key) => {
        if (Array.isArray(value)) {
          this._overrides.text.set(value[0], value[1]);
        } else {
          this._overrides.text.set(key, value);
        }
      });
    } else if (overrides && typeof overrides === 'object') {
      for (const [key, value] of Object.entries(overrides)) {
        if (value) this._overrides.text.set(parseInt(key, 10), value);
      }
    }
  }

  setTypeParser(oid: number, parseFn: ParseFnText): void;
  setTypeParser(oid: number, format: 'text', parseFn: ParseFnText): void;
  setTypeParser(oid: number, format: 'binary', parseFn: ParseFnBinary): void;
  setTypeParser(
    oid: number,
    ...rest: [ParseFnText] | ['text', ParseFnText] | ['binary', ParseFnBinary]
  ) {
    const [a, b] = rest;
    const [format, parseFn] =
      typeof a === 'function' ? (['text', a] as const) : [a, b];
    this._overrides[format].set(oid, parseFn as any);
  }

  getTypeParser(oid: number, format?: 'text'): ParseFnText;
  getTypeParser(oid: number, format: 'binary'): ParseFnBinary;
  getTypeParser(
    oid: number,
    format: 'text' | 'binary' | undefined,
  ): ParseFnText | ParseFnBinary;
  getTypeParser(
    oid: number,
    format: 'text' | 'binary' = 'text',
  ): ParseFnText | ParseFnBinary {
    return this._overrides[format].get(oid) ?? types.getTypeParser(oid, format);
  }
}

/**
 * Parse a composite value and get a tuple of strings where
 * each string represents one attribute.
 *
 * @param value The raw string.
 */
export function parseComposite(value: string): string[] {
  if (value[0] !== '(') {
    throw new Error('composite values should start with (');
  }
  const values = [];
  let currentValue = '';
  let quoted = false;
  for (let i = 1; i < value.length; i++) {
    if (!quoted && value[i] === ',') {
      values.push(currentValue);
      currentValue = '';
      continue;
    } else if (!quoted && value[i] === ')') {
      values.push(currentValue);
      currentValue = '';
      if (i !== value.length - 1) {
        throw new Error('Got ")" before end of value');
      }
      continue;
    } else if (quoted && value[i] === '"') {
      if (value[i + 1] === '"') {
        // if the next value is also a quote, that means we
        // are looking at an escaped quote. Skip this char
        // and insert the quote
        i++;
      } else {
        quoted = false;
        continue;
      }
    } else if (value[i] === '"') {
      quoted = true;
      continue;
    }
    currentValue += value[i];
  }
  if (currentValue) {
    throw new Error('Got to end of value with no ")"');
  }
  return values;
}

const parseStringArray: (value: string) => (string | null)[] =
  types.getTypeParser(PgDataTypeID._text);

export function parseArray<T>(
  value: string,
  entryParser: (entry: string | null) => T,
): T[];
export function parseArray<T>(value: string): (string | null)[];
export function parseArray<T>(
  value: string,
  entryParser?: (entry: string | null) => T,
): T[] | (string | null)[] {
  if (entryParser) {
    return parseStringArray(value).map(entryParser);
  } else {
    return parseStringArray(value);
  }
}

export function getTypeResolver(client: PgClient) {
  return async (typeName: string): Promise<number> => {
    const ts = typeName.split('.');
    let results: {rows: {typeID: number; schemaName: string}[]};
    if (ts.length === 1) {
      results = (await client.query(
        `
          SELECT
            ty.oid as "typeID",
            ns.nspname AS "schemaName"
          FROM pg_catalog.pg_type ty
          INNER JOIN pg_catalog.pg_namespace ns
            ON (ty.typnamespace = ns.oid)
          WHERE lower(ty.typname) = $1;
        `,
        [typeName.toLowerCase()],
      )) as any;
    } else if (ts.length === 2) {
      results = (await client.query(
        `
          SELECT
            ty.oid as "typeID",
            ns.nspname AS "schemaName"
          FROM pg_catalog.pg_type ty
          INNER JOIN pg_catalog.pg_namespace ns
            ON (ty.typnamespace = ns.oid)
          WHERE lower(ns.nspname) = $1 AND lower(ty.typname) = $2;
        `,
        [ts[0].toLowerCase(), ts[1].toLowerCase()],
      )) as any;
    } else {
      throw new Error('Type Name should only have one "." in it');
    }
    if (results.rows.length === 0) {
      throw new Error('Could not find the type ' + typeName);
    }
    if (results.rows.length > 1) {
      throw new Error(
        'The type name ' +
          typeName +
          ' was found in multiple schemas: ' +
          results.rows.map((r) => r.schemaName).join(', '),
      );
    }
    return results.rows[0].typeID;
  };
}
