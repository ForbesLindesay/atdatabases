import {groupBy} from '../utils';

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
  const result = groupBy(inventory, ({quantity}) =>
    quantity < 6 ? restock : sufficient,
  );
  expect(result(restock)).toEqual([
    {name: 'bananas', type: 'fruit', quantity: 5},
  ]);
  expect(result(sufficient)).toEqual([
    {name: 'asparagus', type: 'vegetables', quantity: 9},
    {name: 'goat', type: 'meat', quantity: 23},
    {name: 'cherries', type: 'fruit', quantity: 12},
    {name: 'fish', type: 'meat', quantity: 22},
  ]);
});

test('groupToMap - sparse array', () => {
  const result = groupBy([1, , 3], (x) => x);
  expect(result(undefined)).toEqual([undefined]);
  expect(result(1)).toEqual([1]);
  expect(result(3)).toEqual([3]);
  expect(result(42)).toEqual([]);
});

test('groupToMap - documentation example', () => {
  const blogPosts = [
    {author: 1, title: 'Hello'},
    {author: 1, title: 'World'},
    {author: 2, title: 'Awesome'},
  ];
  const blogPostsByAuthor = groupBy(blogPosts, (p) => p.author);
  const authorOne = blogPostsByAuthor(1).map((p) => p.title);
  expect(authorOne).toEqual(['Hello', 'World']);
  const authorTwo = blogPostsByAuthor(2).map((p) => p.title);
  expect(authorTwo).toEqual(['Awesome']);
  const authorThree = blogPostsByAuthor(3).map((p) => p.title);
  expect(authorThree).toEqual([]);
});
