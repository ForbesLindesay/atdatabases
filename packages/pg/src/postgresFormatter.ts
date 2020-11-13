// based on: https://github.com/brianc/node-postgres/blob/a536afb1a8baa6d584bd460e7c1286d75bb36fe3/lib/client.js#L275-L299
function safeText(str: string) {
  let hasBackslash = false;
  let escaped = `'`;

  for (const c of normalizeUnicode(str)) {
    if (c === `'`) {
      escaped += c + c;
    } else if (c === `\\`) {
      escaped += c + c;
      hasBackslash = true;
    } else {
      escaped += c;
    }
  }

  escaped += "'";

  if (hasBackslash === true) {
    escaped = ' E' + escaped;
  }

  return escaped;
}

/**
 * Replace any un-matched surrogate pairs with \uFFFD so that
 * the string is guaranteed to be a valid utf8 string.
 */
function normalizeUnicode(str: string) {
  // source: https://github.com/ConradIrwin/unicode-dragon/blob/9cf19b282a200a8d2680d7ed8d631a00ef70e131/index.js
  // license: https://github.com/ConradIrwin/unicode-dragon/blob/master/LICENSE.MIT
  return str.replace(/[\uD800-\uDFFF]/g, (chr: string, pos: number) => {
    if (chr.charCodeAt(0) >= 0xd800 && chr.charCodeAt(0) <= 0xdbff) {
      if (
        str.charCodeAt(pos + 1) >= 0xdc00 &&
        str.charCodeAt(pos + 1) <= 0xdfff
      ) {
        return chr;
      } else {
        return '\uFFFD';
      }
    } else {
      if (
        str.charCodeAt(pos - 1) >= 0xd800 &&
        str.charCodeAt(pos - 1) <= 0xdbff
      ) {
        return chr;
      } else {
        return '\uFFFD';
      }
    }
  });
}

function formatValue(value: unknown): string {
  if (value === undefined || value === null) {
    return `null`;
  }

  switch (typeof value) {
    case `string`:
      return safeText(value);
    case `boolean`:
      return value ? `true` : `false`;
    case `bigint`:
      return value.toString();
    case `number`:
      if (Number.isFinite(value)) {
        return value.toString();
      }
      // Converting NaN/+Infinity/-Infinity according to Postgres documentation:
      // http://www.postgresql.org/docs/9.6/static/datatype-numeric.html#DATATYPE-FLOAT
      //
      // NOTE: strings for 'NaN'/'+Infinity'/'-Infinity' are not case-sensitive.
      if (value === Number.POSITIVE_INFINITY) {
        return `'+Infinity'`;
      }
      if (value === Number.NEGATIVE_INFINITY) {
        return `'-Infinity'`;
      }
      return `'NaN'`;
    case `symbol`:
      throw new TypeError(
        `Type Symbol has no meaning for PostgreSQL: ${value.toString()}`,
      );
    default:
      if (value instanceof Date) {
        return formatDate(value);
      }
      if (Array.isArray(value)) {
        return formatArray(value);
      }
      if (value instanceof Buffer) {
        return `'\\x${value.toString(`hex`)}'`;
      }
      return safeText(toJson(value));
  }
}

/**
 * Convert object to JSON, serializing bigint as number.
 *
 * If you parse using `JSON.parse` the bigints will be read as numbers.
 */
function toJson(data: unknown) {
  return JSON.stringify(data, (_, v) =>
    typeof v === `bigint` ? `${v}#bigint` : v,
  ).replace(/"(-?\d+)#bigint"/g, (_, a) => a);
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Converts array of values into PostgreSQL Array Constructor: array[...], as per PostgreSQL documentation:
// http://www.postgresql.org/docs/9.6/static/arrays.html
//
// Arrays of any depth/dimension are supported.
//
// Top-level empty arrays are formatted as literal '{}' to avoid the necessity of explicit type casting,
// as the server cannot automatically infer type of an empty non-literal array.
function formatArray(array: unknown[]) {
  const loop = (a: unknown[]): string =>
    `[` +
    a
      .map((value) => (Array.isArray(value) ? loop(value) : formatValue(value)))
      .join() +
    `]`;
  return array.length ? `ARRAY` + loop(array) : `'{}'`;
}

function formatDate(date: Date) {
  let offset = -date.getTimezoneOffset();

  let year = date.getFullYear();
  const isBCYear = year < 1;
  if (isBCYear) year = Math.abs(year) + 1; // negative years are 1 off their BC representation

  let ret =
    pad(year, 4) +
    '-' +
    pad(date.getMonth() + 1, 2) +
    '-' +
    pad(date.getDate(), 2) +
    'T' +
    pad(date.getHours(), 2) +
    ':' +
    pad(date.getMinutes(), 2) +
    ':' +
    pad(date.getSeconds(), 2) +
    '.' +
    pad(date.getMilliseconds(), 3);

  if (offset < 0) {
    ret += '-';
    offset *= -1;
  } else {
    ret += '+';
  }

  ret += pad(Math.floor(offset / 60), 2) + ':' + pad(offset % 60, 2);
  if (isBCYear) ret += ' BC';
  return safeText(ret);
}

function pad(num: number, digits: number) {
  let str = num.toString(10);
  while (str.length < digits) {
    str = '0' + str;
  }
  return str;
}
