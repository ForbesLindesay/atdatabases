import numberToValidPort from '../numberToValidPort';

test('numberToValidPort', () => {
  expect(numberToValidPort(0, 5, 7)).toBe(5);
  expect(numberToValidPort(1, 5, 7)).toBe(6);
  expect(numberToValidPort(2, 5, 7)).toBe(7);
  expect(numberToValidPort(3, 5, 7)).toBe(5);
  expect(numberToValidPort(4, 5, 7)).toBe(6);
  expect(numberToValidPort(5, 5, 7)).toBe(7);
});
