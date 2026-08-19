import sql, {SQLQuery, SQLItem, SQLItemType} from '@databases/sql/web';

export type ContextComment = {
  action?: string;
  controller?: string;
  framework?: string;
  route?: string;
  application?: string;
} & {[key in string]?: string};

function keySerialization(rawString: string) {
  // URL encode the value e.g. given /param first, that SHOULD become %2Fparam%20first
  const encoded = encodeURIComponent(rawString);
  // Escape meta-characters within the raw value; a single quote ' becomes \'
  const escaped = encoded.replace(/'/g, (char) => `\\${char}`);
  return escaped;
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

function keyValueSerialization([rawKey, rawValue]: [string, string]) {
  return `${keySerialization(rawKey)}=${valueSerialization(rawValue)}`;
}

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

export function addContext(q: SQLQuery, comment: ContextComment): SQLQuery {
  const parts = q.format(toParts);
  if (!parts.length || hasCommentsFromParts(parts)) return q;

  const commentStr = serializeComment(comment);
  if (!commentStr) return q;

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
