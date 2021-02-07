import sql, {SQLQuery, SQLItem, SQLItemType} from '@databases/sql';

function hasValuesFormatter(query: readonly SQLItem[]): boolean {
  return query.some((q) => q.type === SQLItemType.VALUE);
}

/**
 * Test whether the query has any parameters, or whether it is just a static
 * string. Returns `true` if there are parameters.
 */
export function hasValues(query: SQLQuery): boolean {
  return query.format(hasValuesFormatter);
}

function hasSemicolonBeforeEndFormatter(query: readonly SQLItem[]): boolean {
  return query.some((q, i) => {
    if (q.type !== SQLItemType.RAW) return false;
    if (i === query.length - 1) {
      const text = q.text.trim();
      const index = text.indexOf(';');
      return index !== -1 && index < text.length - 1;
    }
    return q.text.includes(';');
  });
}
/**
 * A faster test for whether an SQLQuery is likely to contain multiple statements
 *
 * It is possible for a single query to return `true` if it has a `;` in a comment
 * or in a string literal/identifier name. If `hasSemicolonBeforeEnd` returns `false`
 * you can trust that the query is a single statement.
 */
export function hasSemicolonBeforeEnd(query: SQLQuery): boolean {
  return query.format(hasSemicolonBeforeEndFormatter);
}

function splitSqlQueryParts(query: readonly SQLItem[]): SQLQuery[] {
  let parts: SQLItem[] = [];
  const queries: SQLItem[][] = [parts];
  let quoteChar: undefined | string;
  let lineCommentStart = false;
  let isLineComment = false;
  let blockCommentStart = false;
  let isBlockComment = false;
  let isBlockCommentPrinted = false;
  let isBlockCommentFirstChar = false;
  let isBlockCommentEnd = false;
  for (const part of query) {
    if (part.type === SQLItemType.RAW) {
      let str = '';
      for (const char of part.text) {
        if (lineCommentStart) {
          lineCommentStart = false;
          if (char === '-') {
            isLineComment = true;
          } else {
            str += '-';
          }
        }

        if (blockCommentStart) {
          blockCommentStart = false;
          if (char === '*') {
            isBlockCommentFirstChar = true;
            isBlockComment = true;
          } else {
            str += '/';
          }
        }

        if (isBlockCommentFirstChar) {
          isBlockCommentFirstChar = false;
          if (char === '*') {
            isBlockCommentEnd = true;
          } else if (!/\s/.test(char)) {
            isBlockCommentPrinted = true;
            str += '/*' + char;
          }
        } else if (isBlockComment) {
          if (isBlockCommentPrinted) {
            str += char;
          }
          if (isBlockCommentEnd) {
            isBlockCommentEnd = false;
            if (char === '/') {
              isBlockComment = false;
              isBlockCommentPrinted = false;
            }
          } else if (char === '*') {
            isBlockCommentEnd = true;
          }
        } else if (isLineComment) {
          if (char === '\n') {
            str += '\n';
            isLineComment = false;
          }
        } else if (char === quoteChar) {
          quoteChar = undefined;
          str += char;
        } else if (quoteChar) {
          str += char;
        } else {
          switch (char) {
            case `'`:
            case `"`:
            case '`':
              quoteChar = char;
              str += char;
              break;
            case `-`:
              lineCommentStart = true;
              break;
            case `/`:
              blockCommentStart = true;
              break;
            case `;`:
              if (str.trim()) {
                parts.push({type: SQLItemType.RAW, text: str});
                str = '';
              }
              if (parts.length) {
                parts = [];
                queries.push(parts);
              }
              break;
            default:
              str += char;
              break;
          }
        }
      }
      if (lineCommentStart) {
        str += '-';
      }
      if (blockCommentStart) {
        str += '/';
      }
      if (parts.length || str.trim()) {
        parts.push({type: SQLItemType.RAW, text: str});
      }
    } else {
      parts.push(part);
    }
  }
  return queries
    .filter((parts) => parts.length)
    .map((parts) => sql.__dangerous__constructFromParts(parts));
}

/**
 * Split an SQLQuery into an array of statements
 */
export default function splitSqlQuery(query: SQLQuery): SQLQuery[] {
  if (!hasSemicolonBeforeEnd(query)) return [query];
  const split = query.format(splitSqlQueryParts);
  if (split.length <= 1) {
    return [query];
  } else {
    return split;
  }
}
