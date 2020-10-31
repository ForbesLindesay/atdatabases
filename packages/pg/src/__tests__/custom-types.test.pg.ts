import connect from '..';
import sql from '@databases/sql';

jest.setTimeout(30000);

const db = connect();

enum Currency {
  USD = 'USD',
  GBP = 'GBP',
}
class MoneyWithCurrency {
  constructor(
    public readonly value: string,
    public readonly currency: Currency,
    public readonly description: string,
  ) {}
}
sql.registerFormatter(MoneyWithCurrency, (v) => {
  return sql`ROW (${v.value}, ${v.currency}, ${v.description})`;
});

class BalancePair {
  constructor(
    public readonly income: MoneyWithCurrency,
    public readonly expenditure: MoneyWithCurrency,
  ) {}
}
sql.registerFormatter(BalancePair, (v) => {
  return sql`ROW (${v.income}, ${v.expenditure})`;
});

test('custom types', async () => {
  await db.query(sql`CREATE SCHEMA custom_types`);
  await db.query(
    sql`
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
    `,
  );
  const [parseNumeric, parseCurrency, parseText] = await Promise.all([
    db.getTypeParser('numeric'),
    db.getTypeParser('custom_types.currency'),
    db.getTypeParser('TEXT'),
  ]);
  const parseMoneyWithCurrency = await db.registerTypeParser(
    'custom_types.money_with_currency',
    (value) => {
      const [v, currency, description] = db.parseComposite(value);
      return new MoneyWithCurrency(
        parseNumeric(v),
        parseCurrency(currency),
        parseText(description),
      );
    },
  );
  await db.registerTypeParser('custom_types.balance_pair', (value) => {
    const [income, expenditure] = db.parseComposite(value);
    return new BalancePair(
      parseMoneyWithCurrency(income),
      parseMoneyWithCurrency(expenditure),
    );
  });

  const insert = sql`
    INSERT INTO custom_types.accounts (email, balance)
    VALUES
      (
        ${'forbes@lindesay.co.uk'},
        ${new MoneyWithCurrency(
          '10.20',
          Currency.USD,
          'This is a wonderful "description"!',
        )}
      ),
      (
        ${'dee@lindesay.co.uk'},
        ${new MoneyWithCurrency(
          '100.01',
          Currency.GBP,
          'Descriptions can contain one thing, and another, and another.',
        )}
      );
  `;

  expect(
    insert.format({
      escapeIdentifier: () => {
        throw new Error('Not implemented');
      },
      formatValue: (value, index) => ({placeholder: `$${index + 1}`, value}),
    }),
  ).toMatchInlineSnapshot(`
Object {
  "text": "INSERT INTO custom_types.accounts (email, balance) VALUES ( $1, ROW ($2, $3, $4) ), ( $5, ROW ($6, $7, $8) );",
  "values": Array [
    "forbes@lindesay.co.uk",
    "10.20",
    "USD",
    "This is a wonderful \\"description\\"!",
    "dee@lindesay.co.uk",
    "100.01",
    "GBP",
    "Descriptions can contain one thing, and another, and another.",
  ],
}
`);

  await db.query(insert);
  await db.query(sql`
    INSERT INTO custom_types.balance_pairs (balance)
    VALUES (${new BalancePair(
      new MoneyWithCurrency('10', Currency.GBP, 'Hello World'),
      new MoneyWithCurrency('10', Currency.USD, 'Goodbye World'),
    )})
  `);
  expect(
    await db.query(
      sql`
        SELECT * FROM custom_types.accounts;
      `,
    ),
  ).toMatchInlineSnapshot(`
Array [
  Object {
    "balance": MoneyWithCurrency {
      "currency": "USD",
      "description": "This is a wonderful \\"description\\"!",
      "value": "10.20",
    },
    "email": "forbes@lindesay.co.uk",
  },
  Object {
    "balance": MoneyWithCurrency {
      "currency": "GBP",
      "description": "Descriptions can contain one thing, and another, and another.",
      "value": "100.01",
    },
    "email": "dee@lindesay.co.uk",
  },
]
`);
  expect(
    await db.query(
      sql`
        SELECT * FROM custom_types.balance_pairs;
      `,
    ),
  ).toMatchInlineSnapshot(`
Array [
  Object {
    "balance": BalancePair {
      "expenditure": MoneyWithCurrency {
        "currency": "USD",
        "description": "Goodbye World",
        "value": "10.00",
      },
      "income": MoneyWithCurrency {
        "currency": "GBP",
        "description": "Hello World",
        "value": "10.00",
      },
    },
  },
]
`);
});
