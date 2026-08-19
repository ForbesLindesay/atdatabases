import sql, {FormatConfig, SQLQuery} from '@databases/sql/web';
import {addContext, extractContext, parseComment, serializeComment} from '../';

const formatConfig: FormatConfig = {
  // NOTE: This is not a safe way to escape the identifier, it's good enough for our simple test though.
  escapeIdentifier: (str) => `"${str}"`,
  formatValue: (value) => ({placeholder: '?', value}),
};

function text(q: SQLQuery) {
  return q.format(formatConfig).text;
}

describe('serializeComment', () => {
  test('returns an empty string for an empty comment', () => {
    expect(serializeComment({})).toBe('');
  });

  test('returns an empty string when every value is undefined', () => {
    expect(serializeComment({action: undefined, controller: undefined})).toBe(
      '',
    );
  });

  test('serializes a single key/value pair', () => {
    expect(serializeComment({action: 'index'})).toBe(`/*action='index'*/`);
  });

  test('sorts keys alphabetically, regardless of insertion order', () => {
    expect(
      serializeComment({
        route: '/users',
        action: 'index',
        controller: 'users',
      }),
    ).toBe(`/*action='index',controller='users',route='%2Fusers'*/`);
  });

  test('ignores keys with an undefined value while keeping the rest', () => {
    expect(serializeComment({action: 'index', controller: undefined})).toBe(
      `/*action='index'*/`,
    );
  });

  test('URL encodes and SQL escapes special characters in keys', () => {
    expect(serializeComment({['/param first']: 'value'})).toBe(
      `/*%2Fparam%20first='value'*/`,
    );
  });

  test('URL encodes and SQL escapes special characters in values', () => {
    expect(serializeComment({action: `FOO 'BAR`})).toBe(
      `/*action='FOO%20\\'BAR'*/`,
    );
  });

  test('URL encodes literal backslashes in values', () => {
    // encodeURIComponent turns the backslash into %5C, leaving no literal
    // backslash for the SQL-escaping step to act on.
    expect(serializeComment({action: 'a\\b'})).toBe(`/*action='a%5Cb'*/`);
  });

  test('throws if a value is not a string', () => {
    expect(() => serializeComment({action: 42 as unknown as string})).toThrow(
      `Values for sql-commenter must be strings`,
    );
  });

  test('does not throw for an unpaired high surrogate in a value', () => {
    // `\uD800` on its own is a valid JS/JSON string (JSON.parse happily
    // produces it from `"\ud800"`), but `encodeURIComponent` throws a
    // `URIError` on it - it must be sanitized before encoding, rather than
    // allowing attacker-controlled JSON to crash `prepareQuery`.
    expect(() => serializeComment({action: '\uD800'})).not.toThrow();
    expect(serializeComment({action: '\uD800'})).toBe(`/*action='%EF%BF%BD'*/`);
  });

  test('does not throw for an unpaired low surrogate in a value', () => {
    expect(() => serializeComment({action: '\uDC00'})).not.toThrow();
    expect(serializeComment({action: '\uDC00'})).toBe(`/*action='%EF%BF%BD'*/`);
  });

  test('does not throw for an unpaired surrogate embedded in a larger value', () => {
    expect(serializeComment({action: `before\uD800after`})).toBe(
      `/*action='before%EF%BF%BDafter'*/`,
    );
  });

  test('throws for an unpaired surrogate in a key, rather than sanitizing it', () => {
    // Unlike values, keys are not sanitized - silently mangling a key could
    // make two distinct keys collide, so this throws instead. Callers that
    // accept untrusted keys should validate them first (e.g. with
    // `isValidUnicode` from `@databases/validate-unicode`).
    expect(() => serializeComment({[`\uD800`]: 'value'})).toThrow(
      /unmatched surrogate pairs/,
    );
  });

  test('leaves valid surrogate pairs (e.g. emoji) untouched', () => {
    expect(serializeComment({action: '😀'})).toBe(`/*action='%F0%9F%98%80'*/`);
  });
});

describe('parseComment', () => {
  test('returns null for a string that is not a comment', () => {
    expect(parseComment(`SELECT * FROM foo`)).toBe(null);
    expect(parseComment(``)).toBe(null);
  });

  test('returns null for an empty comment', () => {
    expect(parseComment(`/**/`)).toBe(null);
  });

  test('parses a single key/value pair', () => {
    expect(parseComment(`/*action='index'*/`)).toEqual({action: 'index'});
  });

  test('allows surrounding whitespace', () => {
    expect(parseComment(`  /*action='index'*/  \n`)).toEqual({
      action: 'index',
    });
  });

  test('parses multiple key/value pairs', () => {
    expect(
      parseComment(`/*action='index',application='my-app',controller='foo'*/`),
    ).toEqual({action: 'index', application: 'my-app', controller: 'foo'});
  });

  test('decodes URL encoded and SQL escaped keys and values', () => {
    expect(parseComment(`/*%2Fparam%20first='FOO%20\\'BAR'*/`)).toEqual({
      ['/param first']: `FOO 'BAR`,
    });
  });

  test('correctly captures empty strings as values', () => {
    expect(parseComment(`/*action=''*/`)).toEqual({action: ''});
  });

  test('correctly captures empty strings as values alongside other pairs', () => {
    expect(parseComment(`/*action='',application='my-app'*/`)).toEqual({
      action: '',
      application: 'my-app',
    });
  });

  test('allows unescaped quotes in values', () => {
    // This may not strictly be valid, but we can handle it and
    // that's easier than rejecting it.
    expect(parseComment(`/*key=''''*/`)).toEqual({
      key: `''`,
    });
  });

  test('is the inverse of serializeComment', () => {
    const comment = {
      action: 'index',
      controller: 'users',
      route: '/users/:id',
      application: `my-app's "commenter"`,
    };
    expect(parseComment(serializeComment(comment))).toEqual(comment);
  });

  test('does not pollute Object.prototype via a __proto__ key', () => {
    // NB: {__proto__: 'polluted'} as an object literal would set the
    // prototype rather than creating an own property (and silently ignore
    // the non-object value), so we can't compare against that literal here.
    const comment = parseComment(`/*__proto__='polluted'*/`);
    expect(Object.getPrototypeOf(comment)).toBe(Object.prototype);
    expect(Object.prototype.hasOwnProperty.call(comment, '__proto__')).toBe(
      true,
    );
    expect(comment?.__proto__).toBe('polluted');
    expect(({} as any).polluted).toBeUndefined();
  });

  test('does not pollute Object.prototype via a constructor key', () => {
    const comment = parseComment(`/*constructor='polluted'*/`);
    expect(comment?.constructor).toBe('polluted');
  });

  test('returns null if a pair has no "="', () => {
    expect(parseComment(`/*action*/`)).toBe(null);
  });

  test('returns null if a value is not wrapped in single quotes', () => {
    expect(parseComment(`/*action=index*/`)).toBe(null);
  });

  test('returns null if any one pair is invalid, even if the rest are valid', () => {
    expect(parseComment(`/*action='index',bad,application='my-app'*/`)).toBe(
      null,
    );
  });

  test('returns null (rather than throwing) for a malformed escape sequence', () => {
    // `%` on its own is not valid percent-encoding, so `decodeURIComponent`
    // would throw a `URIError` if it weren't caught internally.
    expect(parseComment(`/*action='%'*/`)).toBe(null);
    expect(parseComment(`/*%='value'*/`)).toBe(null);
    expect(parseComment(`/*action='%zz'*/`)).toBe(null);
  });
  const malformedInputs = [
    ``,
    `/`,
    `/*`,
    `*/`,
    `/**/`,
    `/*=*/`,
    `/*=''*/`,
    `/*key*/`,
    `/*key=*/`,
    `/*key='unterminated*/`,
    `/*%*/`,
    `/*%='value'*/`,
    `/*action='%'*/`,
    `SELECT * FROM foo /*key='value',*/`,
  ];
  for (const input of malformedInputs) {
    test(`never throws, even for malformed the input like ${JSON.stringify(
      input,
    )}`, () => {
      expect(() => parseComment(input)).not.toThrow();
      expect(parseComment(input)).toBe(null);
    });
  }
});

describe('extractContext', () => {
  test('returns the query unchanged and a null comment when there is no comment', () => {
    expect(extractContext(`SELECT * FROM foo`)).toEqual({
      query: `SELECT * FROM foo`,
      comment: null,
    });
  });

  test('keeps the original query (including the comment) if the comment has no pairs at all', () => {
    const query = `SELECT * FROM foo /**/`;
    expect(extractContext(query)).toEqual({query, comment: null});
  });

  test('parses a comment appended to a full query, and strips it from the query', () => {
    expect(extractContext(`SELECT * FROM foo /*action='index'*/`)).toEqual({
      query: `SELECT * FROM foo`,
      comment: {action: 'index'},
    });
  });

  test('ignores trailing whitespace after the comment', () => {
    expect(extractContext(`SELECT * FROM foo /*action='index'*/  \n`)).toEqual({
      query: `SELECT * FROM foo`,
      comment: {action: 'index'},
    });
  });

  test('parses multiple key/value pairs', () => {
    expect(
      extractContext(
        `SELECT * FROM foo /*action='index',application='my-app',controller='bar'*/`,
      ),
    ).toEqual({
      query: `SELECT * FROM foo`,
      comment: {action: 'index', application: 'my-app', controller: 'bar'},
    });
  });

  test('correctly captures empty strings as values', () => {
    expect(extractContext(`SELECT * FROM foo /*action=''*/`)).toEqual({
      query: `SELECT * FROM foo`,
      comment: {action: ''},
    });
  });

  test('is the inverse of addContext', () => {
    const query = addContext(sql`SELECT * FROM foo WHERE id = ${10}`, {
      action: 'index',
      application: 'my-app',
    });
    const {text: formattedQuery} = query.format(formatConfig);
    expect(extractContext(formattedQuery)).toEqual({
      query: `SELECT * FROM foo WHERE id = ?`,
      comment: {action: 'index', application: 'my-app'},
    });
  });

  test('ignores a comment that is not at the end of the query', () => {
    const query = `SELECT * FROM foo /*action='index'*/ WHERE id = 10`;
    expect(extractContext(query)).toEqual({query, comment: null});
  });

  test('keeps the original query (including the comment) if a pair has no "="', () => {
    const query = `SELECT * FROM foo /*action*/`;
    expect(extractContext(query)).toEqual({query, comment: null});
  });

  test('keeps the original query (including the comment) if a value is not wrapped in single quotes', () => {
    const query = `SELECT * FROM foo /*action=index*/`;
    expect(extractContext(query)).toEqual({query, comment: null});
  });

  test('keeps the original query (including the comment) if any one pair is invalid, even if the rest are valid', () => {
    const query = `SELECT * FROM foo /*action='index',bad,application='my-app'*/`;
    expect(extractContext(query)).toEqual({query, comment: null});
  });

  test('keeps the original query (including the comment) for a malformed escape sequence, rather than throwing', () => {
    const query = `SELECT * FROM foo /*action='%'*/`;
    expect(() => extractContext(query)).not.toThrow();
    expect(extractContext(query)).toEqual({query, comment: null});
  });

  const malformedInputs = [
    ``,
    `SELECT * FROM foo`,
    `SELECT * FROM foo /`,
    `SELECT * FROM foo /*`,
    `SELECT * FROM foo /**/`,
    `SELECT * FROM foo /*key*/`,
    `SELECT * FROM foo /*key=*/`,
    `SELECT * FROM foo /*key='unterminated*/`,
    `SELECT * FROM foo /*%*/`,
    `SELECT * FROM foo /*%='value'*/`,
    `SELECT * FROM foo /*action='%'*/`,
    `SELECT * FROM foo /*key='value',*/`,
  ];
  for (const input of malformedInputs) {
    test(`never throws and keeps original query, even for malformed the queries like: ${JSON.stringify(
      input,
    )}`, () => {
      expect(() => extractContext(input)).not.toThrow();
      expect(extractContext(input)).toEqual({query: input, comment: null});
    });
  }
});

describe('addContext', () => {
  test('appends a comment to a simple query', () => {
    const query = addContext(sql`SELECT * FROM foo`, {action: 'index'});
    expect(text(query)).toBe(`SELECT * FROM foo /*action='index'*/`);
  });

  test('appends the comment before a trailing semicolon', () => {
    const query = addContext(sql`SELECT * FROM foo;`, {action: 'index'});
    expect(text(query)).toBe(`SELECT * FROM foo /*action='index'*/`);
  });

  test('appends the comment before a trailing semicolon with whitespace', () => {
    const query = addContext(sql`SELECT * FROM foo ;  `, {action: 'index'});
    expect(text(query)).toBe(`SELECT * FROM foo /*action='index'*/`);
  });

  test('appends a new part when the query ends in a value placeholder', () => {
    const query = addContext(sql`SELECT * FROM foo WHERE id = ${10}`, {
      action: 'index',
    });
    expect(query.format(formatConfig)).toEqual({
      text: `SELECT * FROM foo WHERE id = ? /*action='index'*/`,
      values: [10],
    });
  });

  test('appends a new part when the query ends in an identifier', () => {
    const query = addContext(sql`SELECT * FROM ${sql.ident('foo')}`, {
      action: 'index',
    });
    expect(query.format(formatConfig)).toEqual({
      text: `SELECT * FROM "foo" /*action='index'*/`,
      values: [],
    });
  });

  test('returns the query unchanged if the comment has no keys', () => {
    const query = sql`SELECT * FROM foo`;
    expect(addContext(query, {})).toBe(query);
  });

  test('returns the query unchanged if all comment values are undefined', () => {
    const query = sql`SELECT * FROM foo`;
    expect(addContext(query, {action: undefined})).toBe(query);
  });

  test('returns the query unchanged if it has no parts', () => {
    const query = sql``;
    expect(addContext(query, {action: 'index'})).toBe(query);
  });

  test('returns the query unchanged if it already contains a block comment', () => {
    const query = sql`SELECT * FROM foo /* already commented */`;
    expect(addContext(query, {action: 'index'})).toBe(query);
  });

  test('returns the query unchanged if it already contains a line comment', () => {
    const query = sql`SELECT * FROM foo -- already commented`;
    expect(addContext(query, {action: 'index'})).toBe(query);
  });

  test('does not treat comment markers within interpolated values as existing comments', () => {
    const query = addContext(sql`SELECT * FROM foo WHERE name = ${'--x'}`, {
      action: 'index',
    });
    expect(query.format(formatConfig)).toEqual({
      text: `SELECT * FROM foo WHERE name = ? /*action='index'*/`,
      values: ['--x'],
    });
  });

  test('combines multiple context fields, sorted alphabetically', () => {
    const query = addContext(sql`SELECT * FROM foo`, {
      application: 'my-app',
      route: '/foo',
      controller: 'foo',
      action: 'index',
      framework: 'express',
    });
    expect(text(query)).toBe(
      `SELECT * FROM foo /*action='index',application='my-app',controller='foo',framework='express',route='%2Ffoo'*/`,
    );
  });
});
