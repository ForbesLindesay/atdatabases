import * as t from './types';

class Context {
  throw(error: string, range: [number, number]): never {
    throw new Error(error);
  }
}
export function parseStatementList(
  str: string,
  index: number,
): (t.Explain | t.Statement)[] {
  let i = index;
  const result = [];
  while (i < str.length) {
    const stmt = parseExplainStatement(str, i);
    result.push(stmt);
    i = stmt.range[1];
  }
  return result;
}

function parseExplainStatement(
  str: string,
  index: number,
): t.Explain | t.Statement {
  const match = /^EXPLAIN\s+(?:QUERY\s+PLAN\s+)/i.exec(str);
  if (match) {
    const statement = parseStatement(
      str.substr(match[0].length),
      index + match[0].length,
    );
    return {
      kind: t.NodeKind.Explain,
      range: [index, statement.range[1]],
      statement,
    };
  } else {
    return parseStatement(str, index);
  }
}
function parseStatement(str: string, index: number): t.Statement {}

function parseCteTableName(str: string, index: number, ctx: Context) {
  const tableName = parseIdentifier(str, index, ctx);
  let rest = str.substr(tableName.range[1] - index);
}
function parseIdentifier(
  str: string,
  index: number,
  ctx: Context,
): t.Identifier {
  const match = /^[a-zA-Z0-9_]+/.exec(str);
  if (!match) {
    return ctx.throw('Expected an identifier', [index, index + 1]);
  }
  return {
    kind: t.NodeKind.Identifier,
    range: [index, index + match[0].length],
    value: match[0],
  };
}
