import stringToValidPort from '../stringToValidPort';

test('numberToValidPort', () => {
  expect(stringToValidPort('volume-a', 1000, 2000)).toMatchInlineSnapshot(
    `1980`,
  );
  expect(stringToValidPort('volume-b', 1000, 2000)).toMatchInlineSnapshot(
    `1224`,
  );
});
