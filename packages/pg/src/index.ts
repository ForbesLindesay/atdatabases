import {isSQLError, SQLError, SQLErrorCode} from '@databases/pg-errors';
import sql, {SQLQuery} from '@databases/sql';
import pg = require('pg-promise');
import {TConfig} from 'pg-promise';
import DataTypeID from '@databases/pg-data-type-id';
const {codeFrameColumns} = require('@babel/code-frame');

export {sql, SQLQuery, isSQLError, SQLError, SQLErrorCode, DataTypeID};

export interface Connection {
  query(query: SQLQuery): Promise<any[]>;
  task<T>(fn: (connection: Connection) => Promise<T>): Promise<T>;
  tx<T>(fn: (connection: Connection) => Promise<T>): Promise<T>;
}
// export interface RootConnection extends Connection {
//   dispose(): void;
// }
class ConnectionImplementation {
  protected connection: pg.IBaseProtocol<{}>;
  constructor(connection: pg.IBaseProtocol<{}>) {
    this.connection = connection;
  }
  async query(query: SQLQuery): Promise<any[]> {
    if (!(query instanceof SQLQuery)) {
      throw new Error(
        'Invalid query, you must use @databases/sql to create your queries.',
      );
    }
    if (process.env.NODE_ENV !== 'production') {
      query.disableMinifying();
    }
    try {
      return await this.connection.query(query);
    } catch (ex) {
      if (isSQLError(ex) && ex.position) {
        const position = parseInt(ex.position, 10);
        const q = query.compile();
        const match =
          /syntax error at or near \"([^\"\n]+)\"/.exec(ex.message) ||
          /relation \"([^\"\n]+)\" does not exist/.exec(ex.message);
        let column = 0;
        let line = 1;
        for (let i = 0; i < position; i++) {
          if (q.text[i] === '\n') {
            line++;
            column = 0;
          } else {
            column++;
          }
        }

        const start = {line, column};
        let end: undefined | {line: number; column: number};
        if (match) {
          end = {line, column: column + match[1].length};
        }

        ex.message += `\n\n${codeFrameColumns(q.text, {start, end})}\n`;
      }
      throw ex;
    }
  }
  async task<T>(
    fn: (connection: ConnectionImplementation) => Promise<T>,
  ): Promise<T> {
    return await this.connection.task(t => {
      return fn(new ConnectionImplementation(t)) as any;
    });
  }
  async tx<T>(
    fn: (connection: ConnectionImplementation) => Promise<T>,
  ): Promise<T> {
    return await this.connection.tx(t => {
      return fn(new ConnectionImplementation(t)) as any;
    });
  }
}

class RootConnection extends ConnectionImplementation {
  readonly dispose: () => void;
  private readonly pgp: pg.IMain;
  constructor(connection: pg.IDatabase<{}>, pgp: pg.IMain) {
    super(connection);
    this.dispose = () => connection.$pool.end();
    this.pgp = pgp;
  }
  private async _getTypeID(type: number | string): Promise<number> {
    if (typeof type === 'number') {
      return type;
    }
    const ts = type.split('.');
    let results;
    if (ts.length === 1) {
      results = await this.query(sql`
        SELECT
          ty.oid as "typeID",
          ns.nspname AS "schemaName",
          ty.typname AS "typeName"
        FROM pg_catalog.pg_type ty
        INNER JOIN pg_catalog.pg_namespace ns
          ON (ty.typnamespace = ns.oid)
        WHERE lower(ty.typname) = ${type.toLowerCase()};
      `);
    } else if (ts.length === 2) {
      results = await this.query(sql`
        SELECT
          ty.oid as "typeID",
          ns.nspname AS "schemaName",
          ty.typname AS "typeName"
        FROM pg_catalog.pg_type ty
        INNER JOIN pg_catalog.pg_namespace ns
          ON (ty.typnamespace = ns.oid)
        WHERE lower(ty.typname) = ${ts[1].toLowerCase()} AND lower(ns.nspname) = ${ts[0].toLowerCase()};
      `);
    } else {
      throw new Error('Type Name should only have one "." in it');
    }
    if (results.length === 0) {
      throw new Error('Could not find the type ' + type);
    }
    if (results.length > 1) {
      throw new Error(
        'The type name ' +
          type +
          ' was found in multiple schemas: ' +
          results.map(r => r.schemaName).join(', '),
      );
    }
    return results[0].typeID;
  }
  async registerTypeParser<T>(
    type: number | string,
    parser: (value: string) => T,
  ): Promise<(value: string) => T> {
    const typeID = await this._getTypeID(type);
    this.pgp.pg.types.setTypeParser(typeID, parser);
    return parser;
  }
  async getTypeParser(type: number | string): Promise<(value: string) => any> {
    const typeID = await this._getTypeID(type);
    return this.pgp.pg.types.getTypeParser(typeID);
  }
  /**
   * Parses an n-dimensional array
   *
   * @param value The string value from the database
   * @param entryParser A transform function to apply to each string
   */
  parseArray(
    value: string,
    entryParser?: (entry: string | null) => any,
  ): any[] {
    return (this.pgp.pg.types.arrayParser as any)
      .create(value, entryParser)
      .parse();
  }

  /**
   * Parse a composite value and get a tuple of strings where
   * each string represents one attribute.
   *
   * @param value The raw string.
   */
  parseComposite(value: string): string[] {
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
}

export type ConnectionParamNames =
  | 'database'
  | 'user'
  | 'password'
  | 'port'
  | 'host'
  | 'ssl';
export const ConnectionParamNames = [
  'database',
  'user',
  'password',
  'port',
  'host',
  'ssl',
];

export type ConnectionParams = Pick<TConfig, ConnectionParamNames>;

export interface ConnectionOptions
  extends Pick<TConfig, Exclude<keyof TConfig, ConnectionParamNames>> {
  bigIntAsString?: boolean;
}

export default function createConnection(
  connectionConfig: string | ConnectionParams | undefined = process.env
    .DATABASE_URL,
  {bigIntAsString, ...otherOptions}: ConnectionOptions = {},
): RootConnection {
  if (!connectionConfig) {
    throw new Error(
      'You must provide a connection string for @databases/pg. You can ' +
        'either pass one directly to the createConnection call or set ' +
        'the DATABASE_URL environment variable.',
    );
  }
  if (typeof connectionConfig === 'object') {
    Object.keys(connectionConfig).forEach(key => {
      if (!ConnectionParamNames.includes(key)) {
        throw new Error(`${key} is not a supported key for ConnectionConfig`);
      }
    });
  }

  const pgp = pg();

  // By default we force BIG_INTEGER to return as a JavaScript number because
  // we never expect to handle integers larger than 2^52, but want to allow
  // numbers greater than 2^32 in the database

  if (!bigIntAsString) {
    // BIGINT -> INT
    const parseInteger = pgp.pg.types.getTypeParser(DataTypeID.int4);
    const MAX_SAFE_INTEGER = `${Number.MAX_SAFE_INTEGER}`;
    pgp.pg.types.setTypeParser(DataTypeID.int8, str => {
      if (
        (str && str.length > MAX_SAFE_INTEGER.length) ||
        (str.length === MAX_SAFE_INTEGER.length && str > MAX_SAFE_INTEGER)
      ) {
        throw new Error(
          `JavaScript cannot handle integers great than: ${
            Number.MAX_SAFE_INTEGER
          }`,
        );
      }
      return parseInteger(str);
    });

    // BIGINT ARRAY -> INT ARRAY
    const parseIntegerArray = pgp.pg.types.getTypeParser(DataTypeID.int4);
    pgp.pg.types.setTypeParser(DataTypeID._int8, str => {
      const result = parseIntegerArray(str);
      if (
        result &&
        result.some((val: number) => val && val > Number.MAX_SAFE_INTEGER)
      ) {
        throw new Error(
          `JavaScript cannot handle integers great than: ${
            Number.MAX_SAFE_INTEGER
          }`,
        );
      }
    });
  }

  const connection = pgp(
    typeof connectionConfig === 'object'
      ? {...connectionConfig, ...otherOptions}
      : {connectionString: connectionConfig, ...otherOptions},
  );

  return new RootConnection(connection, pgp);
}

module.exports = createConnection;
module.exports.default = createConnection;
module.exports.sql = sql;
module.exports.SQLQuery = SQLQuery;
module.exports.isSQLError = isSQLError;
module.exports.SQLErrorCode = SQLErrorCode;
module.exports.DataTypeID = DataTypeID;
