import assertValidUnicode from '@databases/validate-unicode';

/**
 * Escapes a Postgres identifier.
 *
 * https://www.postgresql.org/docs/9.1/sql-syntax-lexical.html
 */
export function escapePostgresIdentifier(
  str: string,
  {extended = false}: {extended?: boolean} = {},
): string {
  assertValidUnicode(str);
  minLength(str, 'Postgres');
  maxLength(
    str,
    60,
    'Postgres',
    'https://www.postgresql.org/docs/9.3/sql-syntax-lexical.html',
  );

  if (extended) {
    assertUnicode(str, 'Postgres');
  } else {
    assertAscii(str, 'Postgres', true);
  }

  return quoteString(str, `"`);
}

/**
 * Escapes a MySQL identifier.
 *
 * https://dev.mysql.com/doc/refman/5.7/en/identifiers.html
 */
export function escapeMySqlIdentifier(
  str: string,
  {extended = false}: {extended?: boolean} = {},
): string {
  assertValidUnicode(str);
  minLength(str, 'MySQL');
  maxLength(
    str,
    64,
    'MySQL',
    'http://dev.mysql.com/doc/refman/5.7/en/identifiers.html',
  );

  if (str[str.length - 1] === ' ') {
    throw new Error('MySQL identifiers may not end in whitespace');
  }

  if (extended) {
    // U+0001 .. U+007F
    // U+0080 .. U+FFFF
    assertUnicode(str, 'MySQL');
  } else {
    // U+0001 .. U+007F
    assertAscii(str, 'MySQL', true);
  }

  return quoteString(str, '`');
}

/**
 * Escapes an SQLite identifier.
 *
 * https://sqlite.org/lang_keywords.html
 */
export function escapeSQLiteIdentifier(str: string) {
  assertValidUnicode(str);
  minLength(str, 'SQLite');
  if (str.length > 63) {
    throw new Error(
      'SQLite identifiers are limited to 63 characters in @databases.',
    );
  }

  assertAscii(str, 'SQLite', false);

  return quoteString(str, `"`);
}

function quoteString(str: string, quoteChar: string) {
  if (!str.includes(quoteChar)) return quoteChar + str + quoteChar;
  return (
    quoteChar + str.split(quoteChar).join(quoteChar + quoteChar) + quoteChar
  );
}

const NON_ASCII = /[^\u0001-\u007f]/;
function assertAscii(str: string, db: string, unicodeAvailable: boolean) {
  if (NON_ASCII.test(str)) {
    throw new Error(
      `${db} identifiers must only contain ASCII characters${
        unicodeAvailable
          ? ` (to use unicode, pass {extended: true} when escaping the identifier)`
          : ``
      }`,
    );
  }
}

const NON_UNICODE = /[^\u0001-\uffff]/;
function assertUnicode(str: string, db: string) {
  // U+0001 .. U+007F
  // U+0080 .. U+FFFF
  if (NON_UNICODE.test(str)) {
    throw new Error(
      `${db} identifiers must only contain characters in the range: U+0001 .. U+FFFF`,
    );
  }
}

function minLength(str: string, db: string) {
  if (!str) {
    throw new Error(`${db} identifiers must be at least 1 character long.`);
  }
}
function maxLength(str: string, length: number, db: string, ref: string) {
  if (str.length > length) {
    throw new Error(
      `${db} identifiers must not be longer than ${length} characters. ${str}`,
    );
  }
}
