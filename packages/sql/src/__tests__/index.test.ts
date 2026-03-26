import {expect, test} from '@jest/globals';
import sql from '../';

// @ts-expect-error
const __dirname: string = import.meta.dirname;
if (typeof __dirname !== 'string') throw new Error('Missing __dirname');

test('correctly renders sql', () => {
  const query = sql`
      SELECT *
      FROM foo
      WHERE id = ${10}
      AND created_at > ${new Date(1545238400939)};
  `;
  expect(
    query.format({
      escapeIdentifier: () => {
        throw new Error('not implemented');
      },
      formatValue: (value) => ({placeholder: '?', value}),
    }),
  ).toMatchInlineSnapshot(`
    {
      "text": "SELECT *
    FROM foo
    WHERE id = ?
    AND created_at > ?;",
      "values": [
        10,
        2018-12-19T16:53:20.939Z,
      ],
    }
  `);
});

test('can join parts of query', () => {
  const conditions = [
    sql`id = ${10}`,
    sql`created_at > ${new Date(1545238400939)}`,
  ];
  const query = sql`
      SELECT *
      FROM foo
      WHERE ${sql.join(conditions, sql` AND `)};
  `;
  expect(
    query.format({
      escapeIdentifier: () => {
        throw new Error('not implemented');
      },
      formatValue: (value) => ({placeholder: '?', value}),
    }),
  ).toMatchInlineSnapshot(`
    {
      "text": "SELECT *
    FROM foo
    WHERE id = ? AND created_at > ?;",
      "values": [
        10,
        2018-12-19T16:53:20.939Z,
      ],
    }
  `);
});

test('can read in a file', () => {
  const query = sql.file(`${__dirname}/fixture.sql`);
  expect(
    query.format({
      escapeIdentifier: () => {
        throw new Error('not implemented');
      },
      formatValue: (value) => ({placeholder: '?', value}),
    }),
  ).toMatchInlineSnapshot(`
    {
      "text": "SELECT * FROM my_table;",
      "values": [],
    }
  `);
});
