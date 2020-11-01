/**
 * Replace any un-matched surrogate pairs with \uFFFD so that
 * the string is guaranteed to be a valid utf8 string.
 */
export function removeInvalidUnicode(str: string): string {
  return str.replace(/[\uD800-\uDFFF]/g, (chr: string, pos: number) => {
    if (chr.charCodeAt(0) <= 0xdbff) {
      return pos < str.length &&
        str.charCodeAt(pos + 1) >= 0xdc00 &&
        str.charCodeAt(pos + 1) <= 0xdfff
        ? chr
        : '\uFFFD';
    } else {
      return pos > 0 &&
        str.charCodeAt(pos - 1) >= 0xd800 &&
        str.charCodeAt(pos - 1) <= 0xdbff
        ? chr
        : '\uFFFD';
    }
  });
}

/**
 * Return true if there are no un-matched surrogate pairs, otherwise
 * return false.
 */
export function isValidUnicode(str: string): boolean {
  if (typeof str !== 'string') return false;
  const pattern = /[\uD800-\uDFFF]/g;
  let match;
  // tslint:disable-next-line:no-conditional-assignment
  while ((match = pattern.exec(str))) {
    const pos = match.index;
    if (str.charCodeAt(pos) <= 0xdbff) {
      if (
        pos === str.length - 1 ||
        str.charCodeAt(pos + 1) < 0xdc00 ||
        str.charCodeAt(pos + 1) > 0xdfff
      ) {
        return false;
      }
    } else {
      if (
        pos === 0 ||
        str.charCodeAt(pos - 1) < 0xd800 ||
        str.charCodeAt(pos - 1) > 0xdbff
      ) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Throw an error if the string has unmatched surrogate pairs
 */
export default function assertValidUnicode(str: string): string {
  if (!isValidUnicode(str)) {
    throw new Error(
      `This string contains unmatched surrogate pairs: ${JSON.stringify(str)}`,
    );
  }
  return str;
}
