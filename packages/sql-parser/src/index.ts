import * as t from './types';

// https://jakewheat.github.io/sql-overview/sql-2016-foundation-grammar.html#_7_17_query_expression

class Context {
  throw(error: string, range: [number, number]): never {
    throw new Error(error);
  }
}
interface State<T> {
  index: number;
  src: string;
  result: T;
}
// export function parseStatementList(
//   str: string,
//   index: number,
// ): (t.Explain | t.Statement)[] {
//   let i = index;
//   const result = [];
//   while (i < str.length) {
//     const stmt = parseExplainStatement(str, i);
//     result.push(stmt);
//     i = stmt.range[1];
//   }
//   return result;
// }

// function parseStatement(str: string, index: number): t.Statement {}

export function parseSelectStatement(
  src: string,
  index: number,
  ctx: Context,
): undefined | State<t.SelectStatement> {
  // TODO: https://www.sqlite.org/syntax/factored-select-stmt.html
  if (!/^SELECT\b/i.test(src)) {
    return undefined;
  }
  let remaining = src.replace(/^SELECT\s*/i, '');
  let distinct = /^DISTINCT\b/i.test(remaining);
  remaining = src.replace(/^(?:DISTINCT|ALL)\b\s*/i, '');
}

export function parseResultColumn(
  src: string,
  index: number,
  ctx: Context,
): undefined | State<ResultColumn> {
  if (src[0] === '*') {
    const match = /^.\s*/.exec(src)!;
    return {
      src: src.substr(match[0].length),
      index: index + match[0].length,
      result: {
        kind: t.NodeKind.ResultColumnAll,
        range: [index, index + match[0].length],
      },
    };
  }
  const identifier = parseIdentifier(src, index, ctx);
  if (identifier && /^\.\s*\*/.test(identifier.src)) {
    const match = /^\.\s*\*\s*/.exec(identifier.src)!;
    return {
      src: identifier.src.substr(match[0].length),
      index: identifier.index + match[0].length,
      result: {
        kind: t.NodeKind.ResultColumnAllInTable,
        range: [index, index + match[0].length],
        tableName: identifier.result,
      },
    };
  }
}
export function parseIdentifier(
  src: string,
  index: number,
  ctx: Context,
): undefined | State<t.Identifier> {
  const match = /^[a-zA-Z0-9_]+\b\s*/.exec(src);
  if (!match) {
    return undefined;
  }
  return {
    index: index + match[0].length,
    src: src.substr(match[0].length),
    result: {
      kind: t.NodeKind.Identifier,
      range: [index, index + match[0].length],
      value: match[0],
    },
  };
}

// https://www.sqlite.org/lang_expr.html
export function parseLiteralValue(
  src: string,
  index: number,
  ctx: Context,
): undefined | State<t.LiteralValue | t.NowLiteral> {
  const matchKeyword = /^(true|false|null|current_time|current_date|current_timestamp)\b\s*/i.exec(
    src,
  );
  if (matchKeyword) {
    const keyword = matchKeyword[1].toLowerCase();

    return {
      index: index + matchKeyword[0].length,
      src: src.substr(matchKeyword[0].length),
      result: ['true', 'false', 'null'].includes(keyword)
        ? {
            kind: t.NodeKind.LiteralValue,
            range: [index, index + matchKeyword[1].length],
            value: keyword === 'null' ? null : keyword === 'true',
          }
        : {
            kind: t.NodeKind.NowLiteral,
            range: [index, index + matchKeyword[1].length],
            value: keyword as
              | 'current_time'
              | 'current_date'
              | 'current_timestamp',
          },
    };
  }
  const matchNumber = /^(\-?\d+(?:\.\d+)?)\s*/i.exec(src);
  if (matchNumber) {
    return {
      index: index + matchNumber[0].length,
      src: src.substr(matchNumber[0].length),
      result: {
        kind: t.NodeKind.LiteralValue,
        range: [index, index + matchNumber[1].length],
        value: matchNumber[1].includes('.')
          ? parseFloat(matchNumber[1])
          : parseInt(matchNumber[1], 10),
      },
    };
  }
  return undefined;
}
