import {parse} from '@babel/parser';
import {CodeTokenType} from '../components/CodeBlock';

function getLanguage(lang: string) {
  switch (lang) {
    case 'ts':
    case 'typescript':
      return 'typescript';
    case 'js':
    case 'javascript':
      return 'javascript';
    default:
      return lang;
  }
}
function getType(
  token: {type: 'CommentLine' | 'CommentBlock' | {label: string}},
  value: string,
  previousToken?: {type: {label: string}},
) {
  if (token.type === 'CommentLine' || token.type === 'CommentBlock') {
    return CodeTokenType.Comment;
  }
  switch (token.type.label) {
    case '(':
    case ')':
    case '{':
    case '}':
    case '[':
    case ']':
    case ',':
    case '.':
    case '...':
    case ':':
    case ';':
    case '!':
    case '=>':
    case '=':
    case '?':
    case '??':
    case '|':
    case '*':
    case '?.':
    case '+/-':
    case '${':
    case '==/!=/===/!==':
    case '</>/<=/>=':
    case '++/--':
    case '||':
      return CodeTokenType.Punctuation;
    case '`':
    case 'string':
    case 'template':
      return CodeTokenType.String;
    case 'num':
      return CodeTokenType.Number;
    case 'null':
      return CodeTokenType.Null;
    case 'function':
    case 'const':
    case 'let':
    case 'var':
    case 'import':
    case 'if':
    case 'else':
    case 'return':
    case 'while':
    case 'class':
    case 'this':
    case 'new':
    case 'export':
    case 'default':
    case 'for':
    case 'void':
    case 'throw':
    case 'break':
    case 'true':
    case 'false':
    case 'try':
    case 'catch':
    case 'finally':
      return CodeTokenType.Keyword;
    case 'name':
      if (previousToken?.type.label === '.') {
        return CodeTokenType.Property;
      }
      switch (value) {
        case 'async':
        case 'await':
        case 'from':
        case 'require':
          return CodeTokenType.Keyword;
        default:
          return CodeTokenType.Identifier;
      }
    case 'text':
      return CodeTokenType.Text;
    default:
      throw new Error(`Unsupported token type: ${JSON.stringify(token)}`);
  }
}
enum SqlState {
  None,
  Keyword,
  Template,
}

function simplifyResult(
  tokens: {
    type: CodeTokenType;
    value: string;
  }[],
): {
  type: CodeTokenType;
  value: string;
}[] {
  const results: {
    type: CodeTokenType;
    value: string;
  }[] = [];
  let lastToken:
    | {
        type: CodeTokenType;
        value: string;
      }
    | undefined = undefined;
  for (const {...token} of tokens) {
    if (
      lastToken?.type === token.type ||
      (lastToken && /^\s*$/.test(token.value))
    ) {
      lastToken.value += token.value;
    } else {
      results.push(token);
      lastToken = token;
    }
  }
  return results;
}
function highlightResult(
  tokens: {
    type: CodeTokenType;
    value: string;
  }[],
  highlights: {start: number; end: number}[],
): {
  type: CodeTokenType;
  value: string;
}[] {
  const results: {
    type: CodeTokenType;
    value: string;
    highlight: boolean;
  }[] = [];
  const highlightStack = highlights.slice().reverse();
  let nextHighlight = highlightStack.pop();
  let index = 0;
  for (const token of tokens) {
    if (nextHighlight) {
      const nextStart = Math.max(nextHighlight.start - index, 0);
      const nextEnd = Math.max(nextHighlight.end - index, 0);
      const beforeHighlight = token.value.substring(0, nextStart);
      const inHighlight = token.value.substring(nextStart, nextEnd);
      const afterHighlight = token.value.substring(nextEnd);
      if (beforeHighlight) {
        results.push({
          type: token.type,
          value: beforeHighlight,
          highlight: false,
        });
      }
      if (inHighlight) {
        results.push({
          type: token.type,
          value: inHighlight,
          highlight: true,
        });
      }
      if (afterHighlight) {
        results.push({
          type: token.type,
          value: afterHighlight,
          highlight: false,
        });
        nextHighlight = highlightStack.pop();
      }
    } else {
      results.push({...token, highlight: false});
    }
    index += token.value.length;
  }
  return results;
}

function highlightSQL(
  str: string,
): {
  type: CodeTokenType;
  value: string;
}[] {
  let inComment = false;
  const stack: string[] = [];
  return str
    .split(/\b/g)
    .flatMap((str) => {
      if (str.length <= 1) return [str];
      let result = [str];
      for (const c of [`'`, `"`, '`', `--`, `\n`]) {
        result = result.flatMap((str) =>
          str.length > c.length && str.includes(c)
            ? str.split(c).flatMap((s, i) => (i === 0 ? [s] : [c, s]))
            : str,
        );
      }
      return result;
    })
    .map((part) => {
      if (inComment) {
        if (part === `\n`) {
          inComment = false;
        }
        return {
          type: CodeTokenType.Comment,
          value: part,
        };
      }
      if (stack.length) {
        if (stack[stack.length - 1] === part) {
          stack.pop();
        }
        return {
          type: CodeTokenType.String,
          value: part,
        };
      }
      if (part === `--`) {
        inComment = true;
        return {
          type: CodeTokenType.Comment,
          value: part,
        };
      }
      if (part === `true` || part === `false`) {
        return {
          type: CodeTokenType.Boolean,
          value: part,
        };
      } else if ([`'`, `"`, '`'].includes(part)) {
        stack.push(part);
        return {
          type: CodeTokenType.String,
          value: part,
        };
      } else if (/^[A-Z]+$/.test(part)) {
        return {
          type: CodeTokenType.SqlKeyword,
          value: part,
        };
      } else if (/^[\[\]\(\)\,]+$/.test(part.trim())) {
        return {type: CodeTokenType.Punctuation, value: part};
      } else {
        return {
          type: CodeTokenType.Text,
          value: part,
        };
      }
    });
}

function highlightYamlLine(
  str: string,
): {
  type: CodeTokenType;
  value: string;
}[] {
  if (str.trim().startsWith(`-`)) {
    return [
      {
        type: CodeTokenType.Punctuation,
        value: str.substring(0, str.indexOf(`-`) + 1),
      },
      ...highlightYamlLine(str.substring(str.indexOf(`-`) + 1)),
    ];
  }
  for (const command of [`*`, `&`, `<<: *`]) {
    if (str.trim().startsWith(command)) {
      return [
        {
          type: CodeTokenType.Text,
          value: str.substring(0, str.indexOf(command)),
        },
        {type: CodeTokenType.Keyword, value: command},
        {
          type: CodeTokenType.Identifier,
          value: str.substring(str.indexOf(command) + command.length),
        },
      ];
    }
  }
  if (str.includes(`:`)) {
    return [
      {
        type: CodeTokenType.Identifier,
        value: str.substring(0, str.indexOf(`:`)),
      },
      {type: CodeTokenType.Punctuation, value: `:`},
      ...(str.substring(str.indexOf(`:`) + 1).includes(`:`)
        ? [
            {
              type: CodeTokenType.String,
              value: str.substring(str.indexOf(`:`) + 1),
            },
          ]
        : highlightYamlLine(str.substring(str.indexOf(`:`) + 1))),
    ];
  }
  if (/^\d+$/.test(str.trim())) {
    return [{type: CodeTokenType.Number, value: str}];
  }
  return [{type: CodeTokenType.String, value: str}];
}

function highlightYaml(
  str: string,
): {
  type: CodeTokenType;
  value: string;
}[] {
  return str.split(`\n`).flatMap((str, i) => {
    if (i === 0) {
      return highlightYamlLine(str);
    }
    return [{type: CodeTokenType.Text, value: `\n`}, ...highlightYamlLine(str)];
  });
}

function highlightJSON(
  str: string,
): {
  type: CodeTokenType;
  value: string;
}[] {
  const result: {
    type: CodeTokenType;
    value: string;
  }[] = [];
  let inString = false;
  for (const c of str) {
    if (inString) {
      if (c === `"`) {
        inString = false;
      }
      result.push({type: CodeTokenType.String, value: c});
    } else {
      if (c === `"`) {
        inString = true;
        result.push({type: CodeTokenType.String, value: `"`});
      } else {
        result.push({type: CodeTokenType.Punctuation, value: c});
      }
    }
  }
  return result;
}
/**
 * The code plugin adds a language switcher for consecutive blocks of code
 */
const syntaxHighlight = ({
  code: rawCode,
  language: rawLanguage,
}: {
  code: string;
  language: string;
}) => {
  let highlights: {start: number; end: number}[] = [];
  let code = rawCode.split(`@[[[`).reduce((acc, str, i) => {
    if (i === 0) return acc + str;
    const split = str.split(`]]]@`);
    if (split.length !== 2) {
      throw new Error(`Missing closing "]]]@"`);
    }
    highlights.push({start: acc.length, end: acc.length + split[0].length});
    return acc + split.join(``);
  }, ``);
  const language = getLanguage(rawLanguage);
  if (language === `typescript` || language === `javascript`) {
    const tokens = parse(code, {
      allowImportExportEverywhere: true,
      allowAwaitOutsideFunction: true,
      allowReturnOutsideFunction: true,
      allowSuperOutsideMethod: true,
      allowUndeclaredExports: true,
      plugins: [
        `asyncGenerators`,
        `bigInt`,
        `classPrivateMethods`,
        `classPrivateProperties`,
        `classProperties`,
        `classStaticBlock`,
        `dynamicImport`,
        `exportDefaultFrom`,
        `exportNamespaceFrom`,
        `jsx`,
        `topLevelAwait`,
        ...(language === `typescript` ? ([`typescript`] as const) : []),
      ],
      sourceType: 'module',
      tokens: true,
    }).tokens!.reverse();
    let i = 0;
    const result: {type: CodeTokenType; value: string}[] = [];
    let sqlState = SqlState.None;
    let previousToken: any;
    while (i < code.length) {
      const token = tokens.pop();
      if (!token) {
        const value = code.substring(i);
        result.push({type: getType(token, value, previousToken), value});
        break;
      } else {
        if (i < token.start) {
          result.push({
            type: CodeTokenType.Text,
            value: code.substring(i, token.start),
          });
          i = token.start;
        }
        if (i < token.end) {
          const value = code.substring(Math.max(i, token.start), token.end);
          if (
            token.type.label === 'template' &&
            sqlState === SqlState.Template
          ) {
            result.push(...highlightSQL(value));
            i = token.end;
          } else {
            result.push({
              type: getType(token, value, previousToken),
              value,
            });
            i = token.end;
          }
          if (token.type.label === 'name' && value === 'sql') {
            sqlState = SqlState.Keyword;
          } else if (
            token.type.label === '`' &&
            sqlState === SqlState.Keyword
          ) {
            sqlState = SqlState.Template;
          } else if (
            token.type.label === '`' &&
            sqlState === SqlState.Template
          ) {
            sqlState = SqlState.None;
          } else if (sqlState === SqlState.Keyword) {
            sqlState = SqlState.None;
          }
        }
      }
      previousToken = token;
    }
    return {
      lang: language,
      code: highlightResult(simplifyResult(result), highlights),
    };
  }
  if (language === `yarn` || language === `npm`) {
    return {
      lang: language,
      code: highlightResult(
        simplifyResult(
          code.split(/\b/g).map((str) => {
            switch (str) {
              case 'yarn':
              case 'npm':
              case 'npx':
              case 'add':
              case 'install':
                return {type: CodeTokenType.Keyword, value: str};
              default:
                return {type: CodeTokenType.Text, value: str};
            }
          }),
        ),
        highlights,
      ),
    };
  }
  if (language === 'sql') {
    return {
      lang: language,
      code: highlightResult(simplifyResult(highlightSQL(code)), highlights),
    };
  }
  if (language === 'yaml') {
    return {
      lang: language,
      code: highlightResult(simplifyResult(highlightYaml(code)), highlights),
    };
  }
  if (language === 'json') {
    return {
      lang: language,
      code: highlightResult(simplifyResult(highlightJSON(code)), highlights),
    };
  }
  return {
    lang: language,
    code: highlightResult(
      [{type: CodeTokenType.Text, value: code}],
      highlights,
    ),
  };
};

export default syntaxHighlight;
