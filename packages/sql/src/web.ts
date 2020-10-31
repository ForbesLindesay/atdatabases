// @public

export enum SQLItemType {
  RAW,
  VALUE,
  IDENTIFIER,
}
/**
 * A single, escaped, `SQLQuery` item. These items are assembled into a SQL
 * query through the compile method.
 */
export type SQLItem =
  | {type: SQLItemType.RAW; text: string}
  | {type: SQLItemType.VALUE; value: any}
  | {type: SQLItemType.IDENTIFIER; names: Array<any>};

export interface FormatConfig {
  escapeIdentifier: (str: string) => string;
  formatValue: (
    value: unknown,
    index: number,
  ) => {readonly placeholder: string; readonly value: unknown};
}

const formatter = Symbol('SQL Query Formatter');

const literalSeparators = new Set([
  '',
  ',',
  ', ',
  ' AND ',
  ' OR ',
  ') AND (',
  ') OR (',
  ';',
] as const);
type LiteralSeparator = typeof literalSeparators extends Set<infer T>
  ? T
  : never;
/**
 * The representation of a SQL query. Call `compile` to turn it into a SQL
 * string with value placeholders.
 *
 * This object is immutable. Instead of changing the object, new `SQLQuery`
 * values will be returned.
 *
 * The constructor for this class is private and may not be called.
 */
class SQLQuery {
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
   * Joins multiple queries together and puts a separator in between if a
   * separator was defined.
   */
  public static join(
    queries: Array<SQLQuery>,
    separator?: LiteralSeparator | SQLQuery,
  ): SQLQuery {
    if (typeof separator === 'string' && !literalSeparators.has(separator)) {
      throw new Error(
        `Please tag your string as an SQL query via "sql.join(..., sql\`${
          separator.includes('`') ? 'your_separator' : separator
        }\`)" or use one of the standard speparators: ${[...literalSeparators]
          .map((s) => `"${s}"`)
          .join(', ')}`,
      );
    }
    const items: Array<SQLItem> = [];
    const separatorItems: readonly SQLItem[] | undefined = separator
      ? typeof separator === 'string'
        ? [{type: SQLItemType.RAW, text: separator}]
        : separator._items
      : undefined;

    let addedFirst = false;
    // Add the items of all our queries into the `items` array, adding text
    // separator items as necessary.
    for (const query of queries) {
      if (!addedFirst) {
        addedFirst = true;
      } else if (separatorItems) {
        items.push(...separatorItems);
      }
      items.push(...query._items);
    }

    return new SQLQuery(items);
  }

  /**
   * Creates a new query with the raw text.
   */
  public static __dangerous__rawValue(text: string): SQLQuery {
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
  private readonly _items: readonly SQLItem[];
  private readonly _cache = new Map<any, any>();

  // The constructor is private. Users should use the static `create` method to
  // make a new `SQLQuery`.
  private constructor(items: readonly SQLItem[]) {
    this._items = items;
  }

  public format(config: FormatConfig): {text: string; values: unknown[]};
  public format<T>(formatter: (items: readonly SQLItem[]) => T): T;
  public format<T>(
    formatter: FormatConfig | ((items: readonly SQLItem[]) => T),
  ): T | {text: string; values: unknown[]} {
    const cached = this._cache.get(formatter);
    if (cached) return cached;
    const fresh =
      typeof formatter === 'function'
        ? formatter(this._items)
        : formatStandard(this._items, formatter);
    this._cache.set(formatter, fresh);
    return fresh;
  }
}
export type {SQLQuery};

function formatStandard(
  items: readonly SQLItem[],
  {escapeIdentifier, formatValue}: FormatConfig,
): {
  text: string;
  values: unknown[];
} {
  // Create an empty query object.
  let text = '';
  const values = [];

  const localIdentifiers = new Map<any, string>();

  for (const item of items) {
    switch (item.type) {
      // If this is just raw text, we add it directly to the query text.
      case SQLItemType.RAW: {
        text += item.text;
        break;
      }

      // If we got a value SQL item, add a placeholder and add the value to our
      // placeholder values array.
      case SQLItemType.VALUE: {
        const {placeholder, value} = formatValue(item.value, values.length);
        text += placeholder;
        values.push(value);
        break;
      }

      // If we got an identifier type, escape the strings and get a local
      // identifier for non-string identifiers.
      case SQLItemType.IDENTIFIER: {
        text += item.names
          .map((name): string => {
            if (typeof name === 'string') return escapeIdentifier(name);

            if (!localIdentifiers.has(name))
              localIdentifiers.set(name, `__local_${localIdentifiers.size}__`);

            return escapeIdentifier(localIdentifiers.get(name)!);
          })
          .join('.');
        break;
      }
    }
  }

  if (text.trim()) {
    const lines = text.split('\n');
    const min = Math.min(
      ...lines
        .filter((l) => l.trim() !== '')
        .map((l) => /^\s*/.exec(l)![0].length),
    );
    if (min) {
      text = lines.map((line) => line.substr(min)).join('\n');
    }
  }
  return {text: text.trim(), values};
}

/**
 * The interface we actually expect people to use.
 */
export type SQL = typeof SQLQuery.query & {
  readonly join: typeof SQLQuery.join;
  readonly __dangerous__rawValue: typeof SQLQuery.__dangerous__rawValue;
  readonly value: typeof SQLQuery.value;
  readonly ident: typeof SQLQuery.ident;
  readonly registerFormatter: typeof SQLQuery.registerFormatter;
};

// tslint:disable:no-unbound-method
// Create the SQL interface we export.
const sql: SQL = Object.assign(SQLQuery.query, {
  join: SQLQuery.join,
  __dangerous__rawValue: SQLQuery.__dangerous__rawValue,
  value: SQLQuery.value,
  ident: SQLQuery.ident,
  registerFormatter: SQLQuery.registerFormatter,
});
// tslint:enable:no-unbound-method

export default sql;
export function isSqlQuery(query: unknown): query is SQLQuery {
  return query instanceof SQLQuery;
}

module.exports = sql;
module.exports.default = sql;
module.exports.isSqlQuery = isSqlQuery;
module.exports.SQLItemType = SQLItemType;
