// import {BigQueryInt} from '@google-cloud/bigquery';
import connect, {
  sql,
  BigQueryTableType,
  BigQueryPartitionType,
  Big,
  BigQueryInt,
  BigQueryDate,
  BigQueryDatetime,
  BigQueryTime,
  BigQueryTimestamp,
} from '..';

// TO test locally, you must run both these commands:
//
// gcloud init
// gcloud auth application-default login

const testRunId = new Date().toISOString().replace(/[^0-9]/g, ``);
const tableName = `table_${testRunId}`;
const streamTableName = `stream_table_${testRunId}`;

const db = connect({location: `EU`, projectId: `forbeslindesay`});

const STREAM_ROW_COUNT = 5_000;

test(`create a table`, async () => {
  await db.dataset(`atdatabases_test`).createTable(tableName, {
    type: BigQueryTableType.Table,
    fields: [
      {name: `id`, type: `INT64`},
      {name: `decimal_number`, type: `NUMERIC`},
      {name: `the_date`, type: `DATE`},
      {name: `the_date_time`, type: `DATETIME`},
      {name: `the_time`, type: `TIME`},
      {name: `the_timestamp`, type: `TIMESTAMP`},
    ],
  });

  await db.dataset(`atdatabases_test`).createTable(streamTableName, {
    type: BigQueryTableType.Table,
    fields: [
      {name: `id`, type: `INT64`},
      {name: `value`, type: `STRING`},
    ],
    partition: {
      type: BigQueryPartitionType.Range,
      start: 0,
      interval: 1_000,
      end: STREAM_ROW_COUNT,
      field: `id`,
    },
  });
});

const testDate = new Date('2000-06-03T00:00:00.000Z');
test(`insert records`, async () => {
  await db
    .dataset(`atdatabases_test`)
    .table(tableName)
    .insert([
      {
        id: 1,
        decimal_number: 3.14,
        the_date: `2000-06-03`,
        the_date_time: `2000-06-03T06:14:00`,
        the_time: `04:41:00`,
        the_timestamp: testDate,
      },
      {
        id: 2,
        decimal_number: 3.14,
        the_date: `2000-06-03`,
        the_date_time: `2000-06-03T06:14:00`,
        the_time: `04:41:00`,
        the_timestamp: testDate,
      },
      {
        id: 3,
        decimal_number: 3.14,
        the_date: `2000-06-03`,
        the_date_time: `2000-06-03T06:14:00`,
        the_time: `04:41:00`,
        the_timestamp: testDate,
      },
    ]);
});

test(`insert big records`, async () => {
  const records = [];
  for (let i = 0; i < STREAM_ROW_COUNT; i++) {
    records.push({id: `${i}`, value: `The value is ${i}`});
  }
  await db.dataset(`atdatabases_test`).table(streamTableName).insert(records);
});

test(`wait`, async () => {
  // BigQuery is not transactional. We cannot guarantee that the records we wrote will be immediately available
  await new Promise((resolve) => setTimeout(resolve, 2000));
});

test(`insert record with error`, async () => {
  await expect(
    db
      .dataset(`atdatabases_test`)
      .table(tableName)
      .insert([
        {
          id: 41,
          decimal_number: 3.14,
          the_date: `not a valid date`,
          the_date_time: `2000-06-03T06:14:00`,
          the_time: `04:41:00`,
          the_timestamp: testDate,
        },
      ]),
  ).rejects.toMatchObject({
    message: expect.stringMatching(/Invalid date/),
  });
});

test(`query with syntax error`, async () => {
  await expect(
    db.query(
      sql`SELECT * FRM ${sql.ident(
        `atdatabases_test`,
        tableName,
      )} WHERE id = ${2}`,
    ),
  ).rejects.toMatchObject({
    message: expect.stringMatching(
      /Expected end of input but got identifier "FRM"(.|\n)+\n\> 1 \| SELECT \* FRM.*\n    \|          \^/,
    ),
  });
});

test(`query with on missing table error`, async () => {
  await expect(
    db.query(
      sql`SELECT * FROM ${sql.ident(
        `atdatabases_test`,
        `this_table_does_not_exist`,
      )}`,
    ),
  ).rejects.toMatchObject({
    message: expect.stringMatching(
      /Table.*this_table_does_not_exist was not found/,
    ),
  });
});

test(`insert record with error via SQL`, async () => {
  await expect(
    db.query(sql`
      INSERT INTO ${sql.ident(
        `atdatabases_test`,
        tableName,
      )} (id, decimal_number, the_date, the_date_time, the_time, the_timestamp)
      VALUES (${42}, ${new Big(
        `3.14`,
      )}, ${`not a valid date`}, ${`2000-06-03T06:14:00`}, ${`04:41:00`}, ${testDate})
    `),
  ).rejects.toMatchObject({
    message: expect.stringMatching(/Invalid date/),
  });
});

test(`simple query`, async () => {
  const results = await db.query(
    sql`SELECT * FROM ${sql.ident(
      `atdatabases_test`,
      tableName,
    )} ORDER BY id ASC`,
  );
  expect(results).toEqual([
    {
      id: expect.any(BigQueryInt),
      decimal_number: expect.any(Big),
      the_date: expect.any(BigQueryDate),
      the_date_time: expect.any(BigQueryDatetime),
      the_time: expect.any(BigQueryTime),
      the_timestamp: expect.any(BigQueryTimestamp),
    },
    {
      id: expect.any(BigQueryInt),
      decimal_number: expect.any(Big),
      the_date: expect.any(BigQueryDate),
      the_date_time: expect.any(BigQueryDatetime),
      the_time: expect.any(BigQueryTime),
      the_timestamp: expect.any(BigQueryTimestamp),
    },
    {
      id: expect.any(BigQueryInt),
      decimal_number: expect.any(Big),
      the_date: expect.any(BigQueryDate),
      the_date_time: expect.any(BigQueryDatetime),
      the_time: expect.any(BigQueryTime),
      the_timestamp: expect.any(BigQueryTimestamp),
    },
  ]);

  expect(
    results.map((r) => ({
      id: r.id.value,
      decimal_number: r.decimal_number.toString(),
      the_date: r.the_date.value,
      the_date_time: r.the_date_time.value,
      the_time: r.the_time.value,
      the_timestamp: r.the_timestamp.value,
    })),
  ).toMatchInlineSnapshot(`
    Array [
      Object {
        "decimal_number": "3.14",
        "id": "1",
        "the_date": "2000-06-03",
        "the_date_time": "2000-06-03T06:14:00",
        "the_time": "04:41:00",
        "the_timestamp": "2000-06-03T00:00:00.000Z",
      },
      Object {
        "decimal_number": "3.14",
        "id": "2",
        "the_date": "2000-06-03",
        "the_date_time": "2000-06-03T06:14:00",
        "the_time": "04:41:00",
        "the_timestamp": "2000-06-03T00:00:00.000Z",
      },
      Object {
        "decimal_number": "3.14",
        "id": "3",
        "the_date": "2000-06-03",
        "the_date_time": "2000-06-03T06:14:00",
        "the_time": "04:41:00",
        "the_timestamp": "2000-06-03T00:00:00.000Z",
      },
    ]
  `);
});

test(`simple query on dataset`, async () => {
  const results = await db
    .dataset(`atdatabases_test`)
    .query(sql`SELECT * FROM ${sql.ident(tableName)} ORDER BY id ASC`);
  expect(results).toEqual([
    {
      id: expect.any(BigQueryInt),
      decimal_number: expect.any(Big),
      the_date: expect.any(BigQueryDate),
      the_date_time: expect.any(BigQueryDatetime),
      the_time: expect.any(BigQueryTime),
      the_timestamp: expect.any(BigQueryTimestamp),
    },
    {
      id: expect.any(BigQueryInt),
      decimal_number: expect.any(Big),
      the_date: expect.any(BigQueryDate),
      the_date_time: expect.any(BigQueryDatetime),
      the_time: expect.any(BigQueryTime),
      the_timestamp: expect.any(BigQueryTimestamp),
    },
    {
      id: expect.any(BigQueryInt),
      decimal_number: expect.any(Big),
      the_date: expect.any(BigQueryDate),
      the_date_time: expect.any(BigQueryDatetime),
      the_time: expect.any(BigQueryTime),
      the_timestamp: expect.any(BigQueryTimestamp),
    },
  ]);

  expect(
    results.map((r) => ({
      id: r.id.value,
      decimal_number: r.decimal_number.toString(),
      the_date: r.the_date.value,
      the_date_time: r.the_date_time.value,
      the_time: r.the_time.value,
      the_timestamp: r.the_timestamp.value,
    })),
  ).toMatchInlineSnapshot(`
    Array [
      Object {
        "decimal_number": "3.14",
        "id": "1",
        "the_date": "2000-06-03",
        "the_date_time": "2000-06-03T06:14:00",
        "the_time": "04:41:00",
        "the_timestamp": "2000-06-03T00:00:00.000Z",
      },
      Object {
        "decimal_number": "3.14",
        "id": "2",
        "the_date": "2000-06-03",
        "the_date_time": "2000-06-03T06:14:00",
        "the_time": "04:41:00",
        "the_timestamp": "2000-06-03T00:00:00.000Z",
      },
      Object {
        "decimal_number": "3.14",
        "id": "3",
        "the_date": "2000-06-03",
        "the_date_time": "2000-06-03T06:14:00",
        "the_time": "04:41:00",
        "the_timestamp": "2000-06-03T00:00:00.000Z",
      },
    ]
  `);
});

test(`query with parameter`, async () => {
  const results = await db.query(
    sql`SELECT * FROM ${sql.ident(
      `atdatabases_test`,
      tableName,
    )} WHERE id = ${2}`,
  );

  expect(
    results.map((r) => ({
      id: r.id.value,
      decimal_number: r.decimal_number.toString(),
      the_date: r.the_date.value,
      the_date_time: r.the_date_time.value,
      the_time: r.the_time.value,
      the_timestamp: r.the_timestamp.value,
    })),
  ).toMatchInlineSnapshot(`
    Array [
      Object {
        "decimal_number": "3.14",
        "id": "2",
        "the_date": "2000-06-03",
        "the_date_time": "2000-06-03T06:14:00",
        "the_time": "04:41:00",
        "the_timestamp": "2000-06-03T00:00:00.000Z",
      },
    ]
  `);
});

test(`modern stream`, async () => {
  let i = 0;
  for await (const row of db.queryStream(
    sql`SELECT * FROM ${sql.ident(`atdatabases_test`, streamTableName)}`,
  )) {
    i++;
    expect(row.value).toBe(`The value is ${row.id.value}`);
  }
  expect(i).toBe(STREAM_ROW_COUNT);
});

test(`node.js stream`, async () => {
  let i = 0;
  await new Promise<void>((resolve, reject) => {
    db.queryNodeStream(
      sql`SELECT * FROM ${sql.ident(`atdatabases_test`, streamTableName)}`,
    )
      .on(`data`, (row) => {
        i++;
        expect(row.value).toBe(`The value is ${row.id.value}`);
      })
      .on(`error`, (err) => reject(err))
      .on(`end`, () => resolve());
  });
  expect(i).toBe(STREAM_ROW_COUNT);
});
