import assertValidUnicode, {removeInvalidUnicode, isValidUnicode} from '..';

const pairEscaped = '\ud83d\ude00';
const pairUnescaped = '😀';

const escapedInvalidCharPlaceholder = '\uFFFD';
const invalidCharPlaceholder = '�';

test('Our unicode symbol is made of two surrogate pairs', () => {
  expect(pairEscaped).toBe(pairUnescaped);
  expect(escapedInvalidCharPlaceholder).toBe(invalidCharPlaceholder);
});

test('removeInvalidUnicode', () => {
  expect(removeInvalidUnicode(pairUnescaped)).toBe(pairUnescaped);
  expect(removeInvalidUnicode(pairUnescaped[0])).toBe(invalidCharPlaceholder);
  expect(removeInvalidUnicode(pairUnescaped[1])).toBe(invalidCharPlaceholder);

  expect(removeInvalidUnicode(`hello😀`)).toBe(`hello😀`);
  expect(removeInvalidUnicode(`😀world`)).toBe(`😀world`);
  expect(removeInvalidUnicode(`hello😀world`)).toBe(`hello😀world`);
  expect(removeInvalidUnicode(`hello${pairUnescaped[0]}`)).toBe(
    `hello${invalidCharPlaceholder}`,
  );
  expect(removeInvalidUnicode(`${pairUnescaped[0]}world`)).toBe(
    `${invalidCharPlaceholder}world`,
  );
  expect(removeInvalidUnicode(`hello${pairUnescaped[0]}world`)).toBe(
    `hello${invalidCharPlaceholder}world`,
  );
  expect(removeInvalidUnicode(`hello${pairUnescaped[1]}world`)).toBe(
    `hello${invalidCharPlaceholder}world`,
  );
});

test('isValidUnicode', () => {
  expect(isValidUnicode(pairUnescaped)).toBe(true);
  expect(isValidUnicode(pairUnescaped[0])).toBe(false);
  expect(isValidUnicode(pairUnescaped[1])).toBe(false);

  expect(isValidUnicode(`hello😀world`)).toBe(true);
  expect(isValidUnicode(`hello😀`)).toBe(true);
  expect(isValidUnicode(`😀world`)).toBe(true);
  expect(isValidUnicode(`hello${pairUnescaped[0]}world`)).toBe(false);
  expect(isValidUnicode(`hello${pairUnescaped[1]}world`)).toBe(false);
  expect(isValidUnicode(`${pairUnescaped[0]}world`)).toBe(false);
  expect(isValidUnicode(`${pairUnescaped[1]}world`)).toBe(false);
  expect(isValidUnicode(`hello${pairUnescaped[0]}`)).toBe(false);
  expect(isValidUnicode(`hello${pairUnescaped[1]}`)).toBe(false);
});

test('assertValidUnicode', () => {
  expect(() => assertValidUnicode(pairUnescaped)).not.toThrow();
  expect(() => assertValidUnicode(pairUnescaped[0])).toThrowError(
    `This string contains unmatched surrogate pairs: "\\ud83d"`,
  );
  expect(() => assertValidUnicode(pairUnescaped[1])).toThrowError(
    `This string contains unmatched surrogate pairs: "\\ude00"`,
  );

  expect(() => assertValidUnicode(`hello😀world`)).not.toThrow();
  expect(() =>
    assertValidUnicode(`hello${pairUnescaped[0]}world`),
  ).toThrowError(
    `This string contains unmatched surrogate pairs: "hello\\ud83dworld"`,
  );
  expect(() =>
    assertValidUnicode(`hello${pairUnescaped[1]}world`),
  ).toThrowError(
    `This string contains unmatched surrogate pairs: "hello\\ude00world"`,
  );
});
