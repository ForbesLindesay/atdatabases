import {types} from 'pg';
import PgDataTypeID from '@databases/pg-data-type-id';

export type ParseFnText = (value: string) => any;
export type ParseFnBinary = (value: Buffer) => any;

export interface TypeOverridesConfig {
  bigIntMode: 'string' | 'number' | 'bigint';
}

export default class TypeOverrides {
  private readonly _overrides = {
    text: new Map<number, ParseFnText>(),
    binary: new Map<number, ParseFnBinary>(),
  };
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
