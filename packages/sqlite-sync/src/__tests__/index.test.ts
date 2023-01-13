import connect, {sql} from '../';

const db = connect();

afterAll(() => {
  db.dispose();
});

test('error messages', async () => {
  const s = sql;
  expect(() => {
    db.query(s`
      SELECT * FRM 'baz;
    `);
  }).toThrowErrorMatchingInlineSnapshot(`"near \\"FRM\\": syntax error"`);
});

test('query', () => {
  const [{foo}] = db.query(sql`SELECT 1 + 1 as foo`);
  expect(foo).toBe(2);
});

test('query with params', () => {
  const [{foo}] = db.query(sql`SELECT 1 + ${41} as ${sql.ident('foo')}`);
  expect(foo).toBe(42);
});

test('bigint', () => {
  db.query(
    sql`CREATE TABLE bigint_test_bigints (id BIGINT NOT NULL PRIMARY KEY);`,
  );
  db.query(sql`
    INSERT INTO bigint_test_bigints (id)
    VALUES (1),
           (2),
           (42);
  `);
  const result = db.query(sql`SELECT id from bigint_test_bigints;`);
  expect(result).toEqual([{id: 1}, {id: 2}, {id: 42}]);
});

test('transaction', () => {
  const result = db.tx((tx) => {
    const a = tx.query(sql`SELECT 1 + ${41} as ${sql.ident('foo')}`);
    const b = tx.query(sql`SELECT 1 + 2 as bar;`);
    return {a, b};
  });
  expect(result).toMatchInlineSnapshot(`
    Object {
      "a": Array [
        Object {
          "foo": 42,
        },
      ],
      "b": Array [
        Object {
          "bar": 3,
        },
      ],
    }
  `);
});

test('multiple-statements', () => {
  db.query(
    sql`CREATE TABLE multiple_statements_test(id INT NOT NULL PRIMARY KEY, message VARCHAR(1000) NOT NULL)`,
  );
  expect(
    db.query(sql`
      INSERT INTO multiple_statements_test (id, message)
      VALUES (42, 'The answer to life, the universe and everything');
      SELECT * FROM multiple_statements_test;
    `),
  ).toMatchInlineSnapshot(`
    Array [
      Object {
        "id": 42,
        "message": "The answer to life, the universe and everything",
      },
    ]
  `);
  expect(
    db.query([
      sql`SELECT * FROM multiple_statements_test`,
      sql`SELECT id, message AS aliased_message FROM multiple_statements_test`,
    ]),
  ).toMatchInlineSnapshot(`
    Array [
      Array [
        Object {
          "id": 42,
          "message": "The answer to life, the universe and everything",
        },
      ],
      Array [
        Object {
          "aliased_message": "The answer to life, the universe and everything",
          "id": 42,
        },
      ],
    ]
  `);
});
