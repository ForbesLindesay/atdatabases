import sql, {SQLQuery, SQLItem, SQLItemType} from '@databases/sql/web';

/**
 * A set of key/value pairs to attach to a query as a
 * [sqlcommenter](https://google.github.io/sqlcommenter/) style comment.
 * `action`, `controller`, `framework`, `route` and `application` are the
 * well known keys from the sqlcommenter spec, but you can add any other
 * string keys you want to record.
 *
 * All values must be strings.
 */
export type ContextComment = {
  action?: string;
  controller?: string;
  framework?: string;
  route?: string;
  application?: string;
} & {[key in string]?: string};

function keySerialization(rawString: string) {
  if (!rawString) throw new Error('Key for sql-commenter cannot be empty');
  // URL encode the value e.g. given /param first, that SHOULD become %2Fparam%20first
  const encoded = encodeURIComponent(rawString);
  // Escape meta-characters within the raw value; a single quote ' becomes \'
  const escaped = encoded.replace(/'/g, (char) => `\\${char}`);
  return escaped;
}
function keyDeserialization(rawString: string) {
  // Reverse the meta-character escaping; \' becomes '
  const unescaped = rawString.replace(/\\(.)/g, (_, char) => char);
  const result = decodeURIComponent(unescaped);
  if (!result) throw new Error('Cannot have empty key');
  return result;
}

function valueSerialization(rawString: string) {
  if (typeof rawString !== 'string')
    throw new Error(`Values for sql-commenter must be strings`);
  // URL encode the value e.g. given /param first, that SHOULD become %2Fparam%20first
  const encoded = encodeURIComponent(rawString);
  // Escape meta-characters within the raw value; a single quote ' becomes \'
  const escaped = encoded.replace(/'/g, (char) => `\\${char}`);
  // SQL escape the value by placing it within two single quotes e.g.
  // DROP should become 'DROP'
  // FOO 'BAR should become 'FOO%20\'BAR'
  return `'${escaped}'`;
}
function valueDeserialization(rawString: string) {
  const match = /^\'(.*)\'$/.exec(rawString);
  if (!match) throw new Error('Invalid value');
  // Remove the wrapping single quotes, e.g. 'FOO%20\'BAR' becomes FOO%20\'BAR
  const unquoted = match[1];
  // Reverse the meta-character escaping; \' becomes '
  const unescaped = unquoted.replace(/\\(['\\])/g, (_, char) => char);
  return decodeURIComponent(unescaped);
}

function keyValueSerialization([rawKey, rawValue]: [string, string]) {
  return `${keySerialization(rawKey)}=${valueSerialization(rawValue)}`;
}

function keyValueDeserialization(rawPair: string): [string, string] {
  const splitAt = rawPair.indexOf('=');
  if (splitAt === -1) throw new Error('Invalid pair');
  return [
    keyDeserialization(rawPair.substring(0, splitAt)),
    valueDeserialization(rawPair.substring(splitAt + 1)),
  ];
}

/**
 * Serialize a `ContextComment` into a sqlcommenter style SQL comment, e.g.
 * `/*action='index',application='my-app'*\/`. Keys are sorted alphabetically,
 * and both keys and values are URL encoded and SQL escaped.
 *
 * Keys with an `undefined` value are omitted. If there are no keys left
 * once `undefined` values are removed, this returns an empty string rather
 * than an empty comment (`/**\/`).
 *
 * @throws if any value is not a string, or any key is an empty string.
 */
export function serializeComment(comment: ContextComment) {
  const content = Object.entries(comment)
    .filter(
      <A, B>(p: [A, B]): p is [A, Exclude<B, undefined>] => p[1] !== undefined,
    )
    .sort(([a], [b]) => a.localeCompare(b))
    .map(keyValueSerialization)
    .join(`,`);

  if (content) return `/*${content}*/`;
  return ``;
}

function parseCommentBody(commentBody: string): ContextComment {
  return Object.fromEntries(
    commentBody.split(',').map(keyValueDeserialization),
  );
}

/**
 * Parse a sqlcommenter style SQL comment (e.g.
 * `/*action='index',application='my-app'*\/`) back into the key/value pairs
 * it was created from, reversing `serializeComment`.
 *
 * `comment` must be *only* the comment, optionally surrounded by
 * whitespace - use `extractContext` to pull a trailing comment out of a
 * full query first.
 *
 * Returns `null`, rather than throwing, if `comment` is not a single
 * `/* ... *\/` block comment, if the comment is empty (e.g. `/**\/`), or if
 * any key/value pair within it fails to parse (a missing `=`, a value not
 * wrapped in single quotes, or a malformed percent-encoded key/value). This
 * never throws.
 */
export function parseComment(comment: string): ContextComment | null {
  const match = /^\s*\/\*(.+)\*\/\s*$/.exec(comment);
  if (!match) return null;

  try {
    return parseCommentBody(match[1]);
  } catch {
    return null;
  }
}

function toParts(items: readonly SQLItem[]) {
  return items;
}

function hasCommentsFromParts(items: readonly SQLItem[]) {
  for (const item of items) {
    if (item.type === SQLItemType.RAW) {
      if (item.text.includes(`--`)) return true;
      if (item.text.includes(`/*`)) return true;
    }
  }
  return false;
}

/**
 * Returns a new query with a sqlcommenter style comment (from
 * `serializeComment`) appended to the end. This is normally used via the
 * `prepareQuery` option in `@databases/pg`/`@databases/mysql`/`@databases/mock-db`
 * so that every query run through the connection gets tagged.
 *
 * If `query` is empty, `comment` has no keys (once `undefined` values are
 * removed), or `query` already appears to contain a comment (a line comment or
 * a block comment), `query` is returned unchanged rather than risking
 * corrupting/duplicating a comment.
 */
export function addContext(query: SQLQuery, comment: ContextComment): SQLQuery {
  const parts = query.format(toParts);
  if (!parts.length || hasCommentsFromParts(parts)) return query;

  const commentStr = serializeComment(comment);
  if (!commentStr) return query;

  const lastPart = parts[parts.length - 1];
  return sql.__dangerous__constructFromParts(
    lastPart.type === SQLItemType.RAW
      ? [
          ...parts.slice(0, -1),
          {
            type: SQLItemType.RAW,
            text: `${lastPart.text.replace(/\s*;\s*$/, '')} ${commentStr}`,
          },
        ]
      : [...parts, {type: SQLItemType.RAW, text: ` ${commentStr}`}],
  );
}

/**
 * The result of splitting a query into its statement and its sqlcommenter
 * context, as returned by `extractContext`.
 */
export interface ExtractContextResult {
  /**
   * The query, with the sqlcommenter comment (if any) removed.
   */
  query: string;
  /**
   * The key/value pairs extracted from the sqlcommenter comment, or `null`
   * if there was no comment (or it was empty).
   */
  comment: ContextComment | null;
}
/**
 * Extract the sqlcommenter style comment appended to the end of `query` (e.g.
 * by `addContext`), returning the query with the comment removed alongside
 * the parsed key/value pairs (see `parseComment`).
 *
 * Unlike `parseComment`, `query` can be a full SQL query - e.g. as read from
 * a database log or a tool like `pg_stat_activity` - rather than only the
 * comment.
 *
 * If `query` does not end with a valid, non-empty sqlcommenter comment,
 * `comment` will be `null` and `query` is returned completely unchanged
 * (including any trailing comment that failed to parse). This never throws.
 */
export function extractContext(query: string): ExtractContextResult {
  const start = query.lastIndexOf(`/*`);
  if (start === -1) return {query, comment: null};

  const comment = parseComment(query.substring(start));
  if (!comment) return {query, comment: null};

  const queryWithoutComment = query.substring(0, start).trimEnd();
  return {query: queryWithoutComment, comment};
}
