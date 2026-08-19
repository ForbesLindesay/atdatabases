import sql, {FormatConfig} from '@databases/sql/web';
import {addContext, serializeComment} from '../';

const formatConfig: FormatConfig = {
  // NOTE: This is not a safe way to escape the identifier, it's good enough for our simple test though.
  escapeIdentifier: (str) => `"${str}"`,
  formatValue: (value) => ({placeholder: '?', value}),
};

function text(q: ReturnType<typeof sql>) {
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
