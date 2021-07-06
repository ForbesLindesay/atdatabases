import sql, {SQLQuery, FormatConfig} from '@databases/sql';
import splitSqlQuery, {hasValues, hasSemicolonBeforeEnd} from '..';

test('hasValues', () => {
  expect(hasValues(sql`SELECT * FROM ${sql.ident('my_table')}`)).toBe(false);
  expect(
    hasValues(sql`SELECT * FROM ${sql.ident('my_table')} WHERE id = ${42}`),
  ).toBe(true);
});

test('hasSemicolonBeforeEnd', () => {
  expect(
    hasSemicolonBeforeEnd(sql`SELECT * FROM ${sql.ident('my_table')}`),
  ).toBe(false);
  expect(
    hasSemicolonBeforeEnd(
      sql`SELECT * FROM ${sql.ident('my_table')} WHERE id = ${42};`,
    ),
  ).toBe(false);
  expect(
    hasSemicolonBeforeEnd(sql`
      SELECT * FROM ${sql.ident('my_table')} WHERE id = ${42};
    `),
  ).toBe(false);
  expect(
    hasSemicolonBeforeEnd(sql`
      SELECT * FROM ${sql.ident('my_table')} WHERE val = ${'foo;bar'};
    `),
  ).toBe(false);
  expect(
    hasSemicolonBeforeEnd(sql`
      INSERT INTO ${sql.ident('my_table')} (id, value) VALUES (42, 'foo');
      SELECT * FROM ${sql.ident('my_table')} WHERE id = ${42};
    `),
  ).toBe(true);
});

// N.B. this is a terrible formatter, it's vulnerable to all kinds of SQL injection vulnerabilities
// however, it is useful as it produces very readable outputs for tests
const testFormatter: FormatConfig = {
  escapeIdentifier: (id) => JSON.stringify(id),
  formatValue: (v) => ({placeholder: JSON.stringify(v), value: null}),
};
function doesNotSplit(query: SQLQuery) {
  const split = splitSqlQuery(query);
  expect(split.map((q) => q.format(testFormatter).text)).toEqual([
    query.format(testFormatter).text,
  ]);
  expect(split[0]).toBe(query);
}
test('splitSqlQuery', () => {
  doesNotSplit(sql`SELECT * FROM ${sql.ident('my_table')}`);
  doesNotSplit(sql`SELECT * FROM ${sql.ident('my_table')} WHERE id = ${42};`);
  doesNotSplit(sql`
    SELECT * FROM ${sql.ident('my_table')} WHERE id = ${42};
  `);
  doesNotSplit(sql`
    SELECT * FROM ${sql.ident('my_table')} WHERE val = ${'foo;bar'};
  `);
  doesNotSplit(sql`
    SELECT * FROM ${sql.ident(
      'my_table',
    )} -- semicolons; in; comments; don't count;
    WHERE val = 'foo;bar'
    AND "col;name" = \`other;col\`; -- or identifiers (Postgres or MySQL style)
  `);
  expect(
    splitSqlQuery(sql`
      INSERT INTO ${sql.ident('my_table')} (id, value) VALUES (42, 'foo');
      SELECT * FROM ${sql.ident('my_table')} WHERE id = ${42};
    `).map((q) => q.format(testFormatter)),
  ).toEqual(
    [
      sql`INSERT INTO ${sql.ident('my_table')} (id, value) VALUES (42, 'foo')`,
      sql`SELECT * FROM ${sql.ident('my_table')} WHERE id = ${42}`,
    ].map((q) => q.format(testFormatter)),
  );
});

test('regression - 1', () => {
  expect(
    splitSqlQuery(sql`
      CREATE DOMAIN custom_types.email AS TEXT CHECK (VALUE ~ '^.+@.+$');
      CREATE TYPE custom_types.currency AS ENUM('USD', 'GBP');
      
      CREATE TYPE custom_types.money_with_currency AS (
        value NUMERIC(1000, 2),
        currency custom_types.currency,
        description TEXT
      );
      CREATE TYPE custom_types.balance_pair AS (
        income custom_types.money_with_currency,
        expenditure custom_types.money_with_currency
      );
      
      CREATE TABLE custom_types.accounts (
        email custom_types.email NOT NULL PRIMARY KEY,
        balance custom_types.money_with_currency
      );
      CREATE TABLE custom_types.balance_pairs (
        balance custom_types.balance_pair
      );
    `).length,
  ).toBe(6);
});

test('regression - 2', () => {
  expect(
    splitSqlQuery(sql`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = now();
          RETURN NEW;
      END;
      $$ language 'plpgsql';

      CREATE TRIGGER <trigger_name> BEFORE UPDATE ON <table_name> FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
    `).map((q) => q.format(testFormatter)),
  ).toMatchInlineSnapshot(`
    Array [
      Object {
        "text": "CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = now();
        RETURN NEW;
    END;
    $$ language 'plpgsql'",
        "values": Array [],
      },
      Object {
        "text": "CREATE TRIGGER <trigger_name> BEFORE UPDATE ON <table_name> FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column()",
        "values": Array [],
      },
    ]
  `);
  expect(
    splitSqlQuery(sql`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = now();
          RETURN NEW;
      END;
      $$ language 'plpgsql';

      CREATE TRIGGER <trigger_name> BEFORE UPDATE ON <table_name> FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
    `).length,
  ).toBe(2);
});
