import minify = require('pg-minify');
import {readFileSync} from 'fs';

/**
 * A Postgres query which may be fed directly into the `pg` module for
 * execution.
 */
export interface PGQuery {
  /**
   * The SQL query text with placeholders for values. The placeholders refer to
   * a value in the `values` array.
   */
  text: string;

  /**
   * The values used to fill the placeholders in `text`.
   */
  values: Array<any>;
}

/**
 * A MySQL query which may be fed directly into the `mysql2` module for
 * execution.
 */
export interface MySqlQuery {
  /**
   * The SQL query text with placeholders for values. The placeholders refer to
   * a value in the `values` array.
   */
  text: string;

  /**
   * The values used to fill the placeholders in `text`.
   */
  values: Array<any>;
}

enum SQLItemType {
  RAW,
  VALUE,
  IDENTIFIER,
}
/**
 * A single, escaped, `SQLQuery` item. These items are assembled into a SQL
 * query through the compile method.
 */
type SQLItem =
  | {type: SQLItemType.RAW; text: string}
  | {type: SQLItemType.VALUE; value: any}
  | {type: SQLItemType.IDENTIFIER; names: Array<any>};

const formatter = Symbol('SQL Query Formatter');

const DEFAULT_COMPILE_OPTIONS = {minify: true};
/**
 * The representation of a SQL query. Call `compile` to turn it into a SQL
 * string with value placeholders.
 *
 * This object is immutable. Instead of changing the object, new `SQLQuery`
 * values will be returned.
 *
 * The constructor for this class is private and may not be called.
 */
export default class SQLQuery implements PGQuery {
  public static registerFormatter<T>(
    constructor: new (...args: any[]) => T,
    format: (value: T) => SQLQuery,
  ): void {
    constructor.prototype[formatter] = format;
  }
  /**
   * A template string tag that interpolates literal SQL with placeholder SQL
   * values.
   */
  public static query(
    strings: TemplateStringsArray,
    ...values: Array<any>
  ): SQLQuery {
    const items: Array<SQLItem> = [];

    // Add all of the strings as raw items and values as placeholder values.
    for (let i = 0; i < strings.length; i++) {
      if (strings[i]) {
        items.push({type: SQLItemType.RAW, text: strings[i]});
      }

      if (i < values.length) {
        const value = values[i];

        // If the value is a `SQLQuery`, add all of its items.
        if (value instanceof SQLQuery) {
          for (const item of value._items) items.push(item);
        } else {
          if (value && typeof value === 'object' && formatter in value) {
            const formatted = value[formatter](value);
            if (!(formatted instanceof SQLQuery)) {
              throw new Error(
                'Formatters should always return SQLQuery objects',
              );
            }
            for (const item of formatted._items) items.push(item);
          } else {
            if (
              strings[i + 1] &&
              strings[i + 1].startsWith("'") &&
              strings[i].endsWith("'")
            ) {
              throw new Error(
                `You do not need to wrap values in 'quotes' when using @databases. Any JavaScript string passed via \${...} syntax is already treated as a string. Please remove the quotes around this value.`,
              );
            }
            items.push({type: SQLItemType.VALUE, value});
          }
        }
      }
    }

    return new SQLQuery(items);
  }

  /**
   * Joins multiple queries together and puts a seperator in between if a
   * seperator was defined.
   */
  public static join(queries: Array<SQLQuery>, seperator?: string) {
    const items: Array<SQLItem> = [];

    // Add the items of all our queries into the `items` array, adding text
    // seperator items as necessary.
    for (const query of queries) {
      for (const item of query._items) items.push(item);

      // If we have a seperator, and this is not the last query, add a
      // seperator.
      if (seperator && query !== queries[queries.length - 1])
        items.push({type: SQLItemType.RAW, text: seperator});
    }

    return new SQLQuery(items);
  }

  /**
   * Creates a new query with the contents of a utf8 file
   */
  public static file(filename: string): SQLQuery {
    return new SQLQuery([
      {type: SQLItemType.RAW, text: readFileSync(filename, 'utf8')},
    ]);
  }

  /**
   * Creates a new query with the raw text.
   */
  public static raw(text: string): SQLQuery {
    return new SQLQuery([{type: SQLItemType.RAW, text}]);
  }

  /**
   * Creates a new query with the value. This value will be turned into a
   * placeholder when the query gets compiled.
   */
  public static value(value: any): SQLQuery {
    return new SQLQuery([{type: SQLItemType.VALUE, value}]);
  }

  /**
   * Creates an identifier query. Each name will be escaped, and the
   * names will be concatenated with a period (`.`).
   */
  public static ident(...names: Array<any>): SQLQuery {
    return new SQLQuery([{type: SQLItemType.IDENTIFIER, names}]);
  }

  /**
   * The internal array of SQL items. This array is never mutated, only cloned.
   */
  private readonly _items: Array<SQLItem>;

  /**
   * Storage for our memoized compiled query.
   */
  private _pgQuery: PGQuery | null = null;
  private _pgQueryMinified: boolean | null = null;
  /**
   * Storage for our memoized compiled query.
   */
  private _mysqlQuery: MySqlQuery | null = null;

  // The constructor is private. Users should use the static `create` method to
  // make a new `SQLQuery`.
  private constructor(items: Array<SQLItem>) {
    this._items = items;
  }

  /**
   * The SQL query text with placeholders for values. The placeholders refer to
   * a value in the `values` array.
   */
  public get text(): string {
    return this.compile().text;
  }

  /**
   * The values used to fill the placeholders in `text`.
   */
  public get values(): Array<any> {
    return this.compile().values;
  }

  /**
   * Compiles this SQL query into a Postgres query. Memoized so it only does the
   * work once.
   */
  public compile(
    options: {minify: boolean} = DEFAULT_COMPILE_OPTIONS,
  ): PGQuery {
    // If we don’t yet have a compiled query, create one.
    if (this._pgQuery == null || this._pgQueryMinified !== options.minify) {
      this._pgQuery = compilePG(this._items, options);
      this._pgQueryMinified = options.minify;
    }

    return this._pgQuery;
  }
  /**
   * Compiles this SQL query into a Postgres query. Memoized so it only does the
   * work once.
   */
  public compileMySQL(): MySqlQuery {
    // If we don’t yet have a compiled query, create one.
    if (this._mysqlQuery == null) {
      this._mysqlQuery = compileMySQL(this._items);
    }

    return this._mysqlQuery;
  }
}

/**
 * Compiles a list of `SQLItem`s into a single `PGQuery`.
 */
function compilePG(items: Array<SQLItem>, options: {minify: boolean}): PGQuery {
  // Create an empty query object.
  const query: PGQuery = {
    text: '',
    values: [],
  };

  const localIdentifiers = new Map<any, string>();

  for (const item of items) {
    switch (item.type) {
      // If this is just raw text, we add it directly to the query text.
      case SQLItemType.RAW: {
        query.text += item.text;
        break;
      }

      // If we got a value SQL item, add a placeholder and add the value to our
      // placeholder values array.
      case SQLItemType.VALUE: {
        query.text += `$${query.values.length + 1}`;
        query.values.push(item.value);
        break;
      }

      // If we got an identifier type, escape the strings and get a local
      // identifier for non-string identifiers.
      case SQLItemType.IDENTIFIER: {
        query.text += item.names
          .map((name): string => {
            if (typeof name === 'string') return escapePGIdentifier(name);

            if (!localIdentifiers.has(name))
              localIdentifiers.set(name, `__local_${localIdentifiers.size}__`);

            return localIdentifiers.get(name)!;
          })
          .join('.');
        break;
      }
    }
  }

  // Minify the query text before returning it.
  if (options.minify) {
    query.text = minify(query.text);
  }

  return query;
}

function compileMySQL(items: Array<SQLItem>): MySqlQuery {
  // Create an empty query object.
  const query: MySqlQuery = {
    text: '',
    values: [],
  };

  const localIdentifiers = new Map<any, string>();

  for (const item of items) {
    switch (item.type) {
      // If this is just raw text, we add it directly to the query text.
      case SQLItemType.RAW: {
        query.text += item.text;
        break;
      }

      // If we got a value SQL item, add a placeholder and add the value to our
      // placeholder values array.
      case SQLItemType.VALUE: {
        query.text += `?`;
        query.values.push(item.value);
        break;
      }

      // If we got an identifier type, escape the strings and get a local
      // identifier for non-string identifiers.
      case SQLItemType.IDENTIFIER: {
        query.text += item.names
          .map((name): string => {
            if (typeof name === 'string') return escapeMySqlIdentifier(name);

            if (!localIdentifiers.has(name))
              localIdentifiers.set(name, `__local_${localIdentifiers.size}__`);

            return localIdentifiers.get(name)!;
          })
          .join('.');
        break;
      }
    }
  }

  query.text = query.text.trim();

  return query;
}

/**
 * Escapes a Postgres identifier. Adapted from the [`pg` module][1].
 *
 * [1]: https://github.com/brianc/node-postgres/blob/a536afb1a8baa6d584bd460e7c1286d75bb36fe3/lib/client.js#L255-L272
 */
function escapePGIdentifier(str: string): string {
  if (!str) {
    throw new Error('Postgres identifiers must be at least 1 character long.');
  }
  if (str.length > 63) {
    throw new Error(
      'Postgres identifiers should not be longer than 63 characters. https://www.postgresql.org/docs/9.3/sql-syntax-lexical.html',
    );
  }
  if (!/^[A-Za-z0-9_]*$/.test(str)) {
    throw new Error(
      '@database/sql restricts postgres identifiers to alphanumeric characers and underscores.',
    );
  }

  let escaped = '"';

  for (const c of str) {
    if (c === '"') escaped += c + c;
    else escaped += c;
  }

  escaped += '"';

  return escaped;
}

/**
 * Escapes a MySQL identifier.
 *
 * https://www.codetinkerer.com/2015/07/08/escaping-column-and-table-names-in-mysql-part2.html
 */
function escapeMySqlIdentifier(str: string): string {
  if (!str) {
    throw new Error('MySQL identifiers must be at least 1 character long.');
  }
  if (str.length > 64) {
    throw new Error(
      'MySQL identifiers should not be longer than 64 characters. http://dev.mysql.com/doc/refman/5.7/en/identifiers.html',
    );
  }
  if (str[str.length - 1] === ' ') {
    throw new Error('MySQL identifiers may not end in whitespace');
  }
  if (!/^[A-Za-z0-9_]*$/.test(str)) {
    throw new Error(
      '@database/sql restricts mysql identifiers to alphanumeric characers and underscores.',
    );
  }

  let escaped = '`';

  for (const c of str) {
    if (c === '`') escaped += c + c;
    else escaped += c;
  }

  escaped += '`';

  return escaped;
}
