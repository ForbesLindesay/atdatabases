import groupToMap from '../groupToMap';

test('groupToMap', () => {
  const inventory = [
    {name: 'asparagus', type: 'vegetables', quantity: 9},
    {name: 'bananas', type: 'fruit', quantity: 5},
    {name: 'goat', type: 'meat', quantity: 23},
    {name: 'cherries', type: 'fruit', quantity: 12},
    {name: 'fish', type: 'meat', quantity: 22},
  ];

  const restock = {restock: true};
  const sufficient = {restock: false};
  const result = groupToMap(inventory, ({quantity}) =>
    quantity < 6 ? restock : sufficient,
  );
  expect(result.get(restock)).toEqual([
    {name: 'bananas', type: 'fruit', quantity: 5},
  ]);
  expect(result.get(sufficient)).toEqual([
    {name: 'asparagus', type: 'vegetables', quantity: 9},
    {name: 'goat', type: 'meat', quantity: 23},
    {name: 'cherries', type: 'fruit', quantity: 12},
    {name: 'fish', type: 'meat', quantity: 22},
  ]);
});

test('groupToMap - empty', () => {
  expect(Array.from(groupToMap([], (x) => x))).toEqual([]);
});

test('groupToMap - sparse array', () => {
  expect(Array.from(groupToMap([1, , 3], (x) => x))).toEqual([
    [1, [1]],
    [undefined, [undefined]],
    [3, [3]],
  ]);
});
