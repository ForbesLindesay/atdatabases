import {readFileSync, writeFileSync} from 'fs';
import {inspect} from 'util';
import parseConnectionString from '..';

const examples: (string | {connectionString: string | undefined; env: any})[] =
  [
    // Examples from https://www.postgresql.org/docs/13/libpq-connect.html
    'host=localhost port=5432 dbname=mydb connect_timeout=10',
    'postgresql://',
    'postgresql://localhost',
    'postgresql://localhost:5433',
    'postgresql://localhost/mydb',
    'postgresql://user@localhost',
    'postgresql://user:secret@localhost',
    'postgresql://other@localhost/otherdb?connect_timeout=10&application_name=myapp',
    'postgresql://host1:123,host2:456/somedb?target_session_attrs=any&application_name=myapp',

    // custom examples
    `host=localhost port=5432 dbname=mydb connect_timeout=10 user='my name' password='my\\'password'`,

    // using environment variables
    {connectionString: undefined, env: {PGREQUIRESSL: '1'}},
    {
      connectionString: 'postgresql://example.com',
      env: {PGHOST: 'localhost', PGUSER: 'my_name', PGPASSWORD: 'my_password'},
    },
    {
      connectionString: 'postgresql://my_name:my_password@example.com/my_db',
      env: {PGSSLMODE: 'require'},
    },
  ];

test('parseConnectionString', () => {
  const results: any = {};
  for (const example of examples) {
    const key =
      typeof example === 'string'
        ? `Env: {} Connection String: ${example ?? undefined}`
        : `Env: ${inspect(example.env)} Connection String: ${
            example.connectionString ?? undefined
          }`;
    try {
      results[key] = parseConnectionString(
        typeof example === 'string' ? example : example.connectionString,
        {
          invalidOptionMode: 'error',
          unrecognisedOptionMode: 'error',
          env: typeof example === 'string' ? {} : example.env,
        },
      );
    } catch (ex) {
      results[key] = (ex as Error).message;
    }
  }
  if (process.env.CI) {
    expect(results).toEqual(
      JSON.parse(readFileSync(`${__dirname}/snapshots.json`, 'utf8')),
    );
  } else {
    const output = JSON.stringify(results, null, '  ') + '\n';
    if (output !== readFileSync(`${__dirname}/snapshots.json`, 'utf8')) {
      writeFileSync(`${__dirname}/snapshots.json`, output);
    }
  }
});
