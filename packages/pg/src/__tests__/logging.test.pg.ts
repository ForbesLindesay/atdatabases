import connect from '..';
import sql, {isSqlQuery, SQLQuery} from '@databases/sql';
// import {inspect} from 'util';

jest.setTimeout(30000);

test('logging', async () => {
  const events: string[] = [];
  const eventCatcher = (name: string) => (query: SQLQuery, ...args: any[]) => {
    expect(isSqlQuery(query)).toBe(true);
    events.push(
      `${name}(SQLQuery, ${args
        .map((a) => JSON.stringify(a, null, '  '))
        .join(', ')
        // .replace(/\\n/g, '\n')
        .replace(/\"/g, `'`)
        .replace(/\n/gm, '\n  ')})`,
    );
  };

  const db = connect({
    bigIntMode: 'bigint',
    onQueryStart: eventCatcher('onQueryStart'),
    onQueryResults: eventCatcher('onQueryResults'),
    onQueryError: eventCatcher('onQueryError'),
  });
  await db.query(sql`CREATE SCHEMA logging`);
  await db.query(
    sql`
      CREATE TABLE logging.accounts (
        email TEXT NOT NULL PRIMARY KEY,
        balance BIGINT NOT NULL
      );
    `,
  );

  await db.query(sql`
    INSERT INTO logging.accounts (email, balance)
    VALUES
      (
        ${'forbes@lindesay.co.uk'},
        ${100}
      ),
      (
        ${'dee@lindesay.co.uk'},
        ${200}
      );
  `);

  await db.tx(async (db) => {
    await db.query(
      sql`UPDATE logging.accounts SET balance=${200} WHERE email=${'forbes@lindesay.co.uk'}`,
    );
    await db.query(
      sql`UPDATE logging.accounts SET balance=${100} WHERE email=${'dee@lindesay.co.uk'}`,
    );
  });
  await db.tx(async (db) => {
    await db.query([
      sql`UPDATE logging.accounts SET balance=${100} WHERE email=${'forbes@lindesay.co.uk'}`,
      sql`UPDATE logging.accounts SET balance=${200} WHERE email=${'dee@lindesay.co.uk'}`,
    ]);
  });
  await db.tx(async (db) => {
    await db.query(sql`
      UPDATE logging.accounts SET balance=${100} WHERE email=${'forbes@lindesay.co.uk'};
      UPDATE logging.accounts SET balance=${200} WHERE email=${'dee@lindesay.co.uk'};
    `);
  });
  await db
    .query([
      sql`
        UPDATE logging.accounts SET bal=${100} WHERE email=${'forbes@lindesay.co.uk'};
      `,
    ])
    .then(
      () => {
        throw new Error('Expected an error to be thrown');
      },
      () => {
        // ignoring the error
      },
    );

  expect(events).toMatchInlineSnapshot(`
    Array [
      "onQueryStart(SQLQuery, {
        'text': 'CREATE SCHEMA logging',
        'values': []
      })",
      "onQueryResults(SQLQuery, {
        'text': 'CREATE SCHEMA logging',
        'values': []
      }, [])",
      "onQueryStart(SQLQuery, {
        'text': 'CREATE TABLE logging.accounts (\\\\n  email TEXT NOT NULL PRIMARY KEY,\\\\n  balance BIGINT NOT NULL\\\\n);',
        'values': []
      })",
      "onQueryResults(SQLQuery, {
        'text': 'CREATE TABLE logging.accounts (\\\\n  email TEXT NOT NULL PRIMARY KEY,\\\\n  balance BIGINT NOT NULL\\\\n);',
        'values': []
      }, [])",
      "onQueryStart(SQLQuery, {
        'text': 'INSERT INTO logging.accounts (email, balance)\\\\nVALUES\\\\n  (\\\\n    $1,\\\\n    $2\\\\n  ),\\\\n  (\\\\n    $3,\\\\n    $4\\\\n  );',
        'values': [
          'forbes@lindesay.co.uk',
          100,
          'dee@lindesay.co.uk',
          200
        ]
      })",
      "onQueryResults(SQLQuery, {
        'text': 'INSERT INTO logging.accounts (email, balance)\\\\nVALUES\\\\n  (\\\\n    $1,\\\\n    $2\\\\n  ),\\\\n  (\\\\n    $3,\\\\n    $4\\\\n  );',
        'values': [
          'forbes@lindesay.co.uk',
          100,
          'dee@lindesay.co.uk',
          200
        ]
      }, [])",
      "onQueryStart(SQLQuery, {
        'text': 'UPDATE logging.accounts SET balance=$1 WHERE email=$2',
        'values': [
          200,
          'forbes@lindesay.co.uk'
        ]
      })",
      "onQueryResults(SQLQuery, {
        'text': 'UPDATE logging.accounts SET balance=$1 WHERE email=$2',
        'values': [
          200,
          'forbes@lindesay.co.uk'
        ]
      }, [])",
      "onQueryStart(SQLQuery, {
        'text': 'UPDATE logging.accounts SET balance=$1 WHERE email=$2',
        'values': [
          100,
          'dee@lindesay.co.uk'
        ]
      })",
      "onQueryResults(SQLQuery, {
        'text': 'UPDATE logging.accounts SET balance=$1 WHERE email=$2',
        'values': [
          100,
          'dee@lindesay.co.uk'
        ]
      }, [])",
      "onQueryStart(SQLQuery, {
        'text': 'UPDATE logging.accounts SET balance=$1 WHERE email=$2',
        'values': [
          100,
          'forbes@lindesay.co.uk'
        ]
      })",
      "onQueryStart(SQLQuery, {
        'text': 'UPDATE logging.accounts SET balance=$1 WHERE email=$2',
        'values': [
          200,
          'dee@lindesay.co.uk'
        ]
      })",
      "onQueryResults(SQLQuery, {
        'text': 'UPDATE logging.accounts SET balance=$1 WHERE email=$2',
        'values': [
          100,
          'forbes@lindesay.co.uk'
        ]
      }, [])",
      "onQueryResults(SQLQuery, {
        'text': 'UPDATE logging.accounts SET balance=$1 WHERE email=$2',
        'values': [
          200,
          'dee@lindesay.co.uk'
        ]
      }, [])",
      "onQueryStart(SQLQuery, {
        'text': 'UPDATE logging.accounts SET balance=$1 WHERE email=$2',
        'values': [
          100,
          'forbes@lindesay.co.uk'
        ]
      })",
      "onQueryStart(SQLQuery, {
        'text': 'UPDATE logging.accounts SET balance=$1 WHERE email=$2',
        'values': [
          200,
          'dee@lindesay.co.uk'
        ]
      })",
      "onQueryResults(SQLQuery, {
        'text': 'UPDATE logging.accounts SET balance=$1 WHERE email=$2',
        'values': [
          100,
          'forbes@lindesay.co.uk'
        ]
      }, [])",
      "onQueryResults(SQLQuery, {
        'text': 'UPDATE logging.accounts SET balance=$1 WHERE email=$2',
        'values': [
          200,
          'dee@lindesay.co.uk'
        ]
      }, [])",
      "onQueryStart(SQLQuery, {
        'text': 'UPDATE logging.accounts SET bal=$1 WHERE email=$2;',
        'values': [
          100,
          'forbes@lindesay.co.uk'
        ]
      })",
      "onQueryError(SQLQuery, {
        'text': 'UPDATE logging.accounts SET bal=$1 WHERE email=$2;',
        'values': [
          100,
          'forbes@lindesay.co.uk'
        ]
      }, {
        'length': 126,
        'name': 'error',
        'severity': 'ERROR',
        'code': '42703',
        'position': '29',
        'file': 'analyze.c',
        'line': '2339',
        'routine': 'transformUpdateTargetList'
      })",
    ]
  `);

  await db.dispose();
});

const mockConsole = {
  log: jest.fn(),
};
test('docs examples - simple', async () => {
  const console = mockConsole;
  const db = connect({
    bigIntMode: 'bigint',
    onQueryStart: (_query, {text, values}) => {
      console.log(
        `${new Date().toISOString()} START QUERY ${text} - ${JSON.stringify(
          values,
        )}`,
      );
    },
    onQueryResults: (_query, {text}, results) => {
      console.log(
        `${new Date().toISOString()} END QUERY   ${text} - ${
          results.length
        } results`,
      );
    },
    onQueryError: (_query, {text}, err) => {
      console.log(
        `${new Date().toISOString()} ERROR QUERY ${text} - ${err.message}`,
      );
    },
  });

  await db.tx(async (db) => {
    await db.query(
      sql`UPDATE logging.accounts SET balance=${200} WHERE email=${'forbes@lindesay.co.uk'}`,
    );
    await db.query(
      sql`UPDATE logging.accounts SET balance=${100} WHERE email=${'dee@lindesay.co.uk'}`,
    );
  });

  await db.dispose();

  expect(console.log).toBeCalledTimes(4);
  console.log.mockClear();
});

test('docs examples - timing', async () => {
  const console = mockConsole;
  const startTimes = new Map<SQLQuery, number>();
  const db = connect({
    bigIntMode: 'bigint',
    onQueryStart: (query) => {
      startTimes.set(query, Date.now());
    },
    onQueryResults: (query, {text}, results) => {
      const start = startTimes.get(query);
      startTimes.delete(query);

      if (start) {
        console.log(`${text} - ${Date.now() - start}ms`);
      } else {
        console.log(`${text} - uknown duration`);
      }
    },
    onQueryError: (query, {text}, err) => {
      startTimes.delete(query);
      console.log(`${text} - ${err.message}`);
    },
  });

  await db.tx(async (db) => {
    await db.query(
      sql`UPDATE logging.accounts SET balance=${200} WHERE email=${'forbes@lindesay.co.uk'}`,
    );
    await db.query(
      sql`UPDATE logging.accounts SET balance=${100} WHERE email=${'dee@lindesay.co.uk'}`,
    );
  });

  await db.dispose();

  expect(console.log).toBeCalledTimes(2);
});
