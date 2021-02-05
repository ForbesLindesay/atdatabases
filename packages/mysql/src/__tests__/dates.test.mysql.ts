import connect, {sql} from '..';

const mysql: {
  createConnection: (opts: any) => any;
} = require('mysql2/promise');

jest.setTimeout(30000);

const db = connect();

const rawConnection = mysql.createConnection({
  uri: process.env.MYSQL_URL,
  dateStrings: true,
});
const rawConnection2 = mysql.createConnection({
  uri: process.env.MYSQL_URL,
  dateStrings: true,
});

beforeAll(async () => {
  await (await rawConnection).query(`SET time_zone = "+00:00";`);
});
afterAll(async () => {
  await db.dispose();
  (await rawConnection).close();
  (await rawConnection2).close();
});

test('dates', async () => {
  await db.task(async (db) => {
    await db.query(sql`SET time_zone = "+00:00";`);
    await db.query(sql`
      DROP TABLE IF EXISTS dates_test_dates;
      CREATE TABLE dates_test_dates (
        id INT NOT NULL PRIMARY KEY,
        a DATETIME NOT NULL,
        b TIMESTAMP NOT NULL,
        c TIME NOT NULL,
        d YEAR NOT NULL
      );
      DROP TABLE IF EXISTS dates_test_pure_dates;
      CREATE TABLE dates_test_pure_dates (
        id INT NOT NULL PRIMARY KEY,
        date_value DATE NOT NULL
      );
    `);

    const sampleDate = new Date('2000-06-03T05:40:10.123Z');
    await db.query(sql`
      INSERT INTO dates_test_dates (id, a, b, c, d)
      VALUES (1, ${sampleDate}, ${sampleDate}, ${sampleDate}, ${2000}),
            (2, ${'2000-06-03 05:40:10'}, ${'2000-06-03 05:40:10'}, ${'05:40:10.123'}, ${2000});
    `);
    await db.query(sql`
      INSERT INTO dates_test_pure_dates (id, date_value)
      VALUES (1, ${'2000-06-03'}),
            (2, ${new Date('2000-06-03T00:00:00.000Z')}),
            (3, ${new Date('2000-06-03T01:00:00.000Z')}),
            (4, ${new Date('2000-06-03T23:00:00.000Z')});
    `);

    expect(
      (await (await rawConnection).query(`SELECT * from dates_test_dates`))[0],
    ).toEqual([
      {
        a: '2000-06-03 15:10:10',
        b: '2000-06-03 15:10:10',
        c: '15:10:10',
        d: 2000,
        id: 1,
      },
      {
        a: '2000-06-03 05:40:10',
        b: '2000-06-03 05:40:10',
        c: '05:40:10',
        d: 2000,
        id: 2,
      },
    ]);
    expect(
      (
        await (await rawConnection).query(`SELECT * from dates_test_pure_dates`)
      )[0],
    ).toEqual([
      {
        date_value: '2000-06-03',
        id: 1,
      },
      {
        date_value: '2000-06-03',
        id: 2,
      },
      {
        date_value: '2000-06-03',
        id: 3,
      },
      {
        date_value: '2000-06-04',
        id: 4,
      },
    ]);

    const result = await db.query(sql`
      SELECT * from dates_test_dates;
    `);
    expect(result).toEqual([
      {
        a: new Date('2000-06-03T05:40:10.000Z'),
        b: new Date('2000-06-03T05:40:10.000Z'),
        c: '15:10:10',
        d: 2000,
        id: 1,
      },
      {
        a: new Date('2000-06-02T20:10:10.000Z'),
        b: new Date('2000-06-02T20:10:10.000Z'),
        c: '05:40:10',
        d: 2000,
        id: 2,
      },
    ]);
    expect(
      await db.query(sql`
        SELECT * from dates_test_pure_dates;
      `),
    ).toEqual([
      {
        date_value: new Date('2000-06-02T14:30:00.000Z'),
        id: 1,
      },
      {
        date_value: new Date('2000-06-02T14:30:00.000Z'),
        id: 2,
      },
      {
        date_value: new Date('2000-06-02T14:30:00.000Z'),
        id: 3,
      },
      {
        date_value: new Date('2000-06-03T14:30:00.000Z'),
        id: 4,
      },
    ]);
  });
});

test('dates with timezone set to local', async () => {
  // setting timezone on another connection has no impact
  await (await rawConnection2).query(`SET time_zone = "+03:00";`);
  const db = connect({timeZone: 'local'});
  await db.task(async (db) => {
    // Setting timezone to match our local timezone means that fields of type `TIMESTAMP` are stored
    // as UTC, and then returned as local time. This means we are now storing the correct times for
    // `TIMESTAMP` fields.
    // The `rawConnection` is still set to UTC, so you can see the actual UTC values being stored.
    await db.query(sql`
      DROP TABLE IF EXISTS dates_test_dates;
      CREATE TABLE dates_test_dates (
        id INT NOT NULL PRIMARY KEY,
        a DATETIME NOT NULL,
        b TIMESTAMP NOT NULL,
        c TIME NOT NULL,
        d YEAR NOT NULL
      );
      DROP TABLE IF EXISTS dates_test_pure_dates;
      CREATE TABLE dates_test_pure_dates (
        id INT NOT NULL PRIMARY KEY,
        date_value DATE NOT NULL
      );
    `);

    const sampleDate = new Date('2000-06-03T05:40:10.123Z');
    await db.query(sql`
      INSERT INTO dates_test_dates (id, a, b, c, d)
      VALUES (1, ${sampleDate}, ${sampleDate}, ${sampleDate}, ${2000}),
            (2, ${'2000-06-03 05:40:10'}, ${'2000-06-03 05:40:10'}, ${'05:40:10.123'}, ${2000});
    `);
    await db.query(sql`
      INSERT INTO dates_test_pure_dates (id, date_value)
      VALUES (1, ${'2000-06-03'}),
            (2, ${new Date('2000-06-03T00:00:00.000Z')}),
            (3, ${new Date('2000-06-03T01:00:00.000Z')}),
            (4, ${new Date('2000-06-03T23:00:00.000Z')});
    `);

    expect(
      (await (await rawConnection).query(`SELECT * from dates_test_dates`))[0],
    ).toEqual([
      {
        a: '2000-06-03 15:10:10',
        b: '2000-06-03 05:40:10',
        c: '15:10:10',
        d: 2000,
        id: 1,
      },
      {
        a: '2000-06-03 05:40:10',
        b: '2000-06-02 20:10:10',
        c: '05:40:10',
        d: 2000,
        id: 2,
      },
    ]);
    expect(
      (
        await (await rawConnection).query(`SELECT * from dates_test_pure_dates`)
      )[0],
    ).toEqual([
      {
        date_value: '2000-06-03',
        id: 1,
      },
      {
        date_value: '2000-06-03',
        id: 2,
      },
      {
        date_value: '2000-06-03',
        id: 3,
      },
      {
        date_value: '2000-06-04',
        id: 4,
      },
    ]);

    const result = await db.query(sql`
      SELECT * from dates_test_dates;
    `);
    expect(result).toEqual([
      {
        a: new Date('2000-06-03T05:40:10.000Z'),
        b: new Date('2000-06-03T05:40:10.000Z'),
        c: '15:10:10',
        d: 2000,
        id: 1,
      },
      {
        a: new Date('2000-06-02T20:10:10.000Z'),
        b: new Date('2000-06-02T20:10:10.000Z'),
        c: '05:40:10',
        d: 2000,
        id: 2,
      },
    ]);
    expect(
      await db.query(sql`
        SELECT * from dates_test_pure_dates;
      `),
    ).toEqual([
      {
        date_value: new Date('2000-06-02T14:30:00.000Z'),
        id: 1,
      },
      {
        date_value: new Date('2000-06-02T14:30:00.000Z'),
        id: 2,
      },
      {
        date_value: new Date('2000-06-02T14:30:00.000Z'),
        id: 3,
      },
      {
        date_value: new Date('2000-06-03T14:30:00.000Z'),
        id: 4,
      },
    ]);
  });
  await db.dispose();
});

test('dates with timezone set to utc', async () => {
  // setting timezone on another connection has no impact
  await (await rawConnection2).query(`SET time_zone = "+04:00";`);
  const db = connect({timeZone: 'utc'});
  await db.task(async (db) => {
    await db.query(sql`
      DROP TABLE IF EXISTS dates_test_dates;
      CREATE TABLE dates_test_dates (
        id INT NOT NULL PRIMARY KEY,
        a DATETIME NOT NULL,
        b TIMESTAMP NOT NULL,
        c TIME NOT NULL,
        d YEAR NOT NULL
      );
      DROP TABLE IF EXISTS dates_test_pure_dates;
      CREATE TABLE dates_test_pure_dates (
        id INT NOT NULL PRIMARY KEY,
        date_value DATE NOT NULL
      );
    `);

    const sampleDate = new Date('2000-06-03T05:40:10.123Z');
    await db.query(sql`
      INSERT INTO dates_test_dates (id, a, b, c, d)
      VALUES (1, ${sampleDate}, ${sampleDate}, ${sampleDate}, ${2000}),
            (2, ${'2000-06-03 05:40:10'}, ${'2000-06-03 05:40:10'}, ${'05:40:10.123'}, ${2000});
    `);
    await db.query(sql`
      INSERT INTO dates_test_pure_dates (id, date_value)
      VALUES (1, ${'2000-06-03'}),
            (2, ${new Date('2000-06-03T00:00:00.000Z')}),
            (3, ${new Date('2000-06-03T01:00:00.000Z')}),
            (4, ${new Date('2000-06-03T23:00:00.000Z')});
    `);

    expect(
      (await (await rawConnection).query(`SELECT * from dates_test_dates`))[0],
    ).toEqual([
      {
        a: '2000-06-03 05:40:10',
        b: '2000-06-03 05:40:10',
        c: '05:40:10',
        d: 2000,
        id: 1,
      },
      {
        a: '2000-06-03 05:40:10',
        b: '2000-06-03 05:40:10',
        c: '05:40:10',
        d: 2000,
        id: 2,
      },
    ]);
    expect(
      (
        await (await rawConnection).query(`SELECT * from dates_test_pure_dates`)
      )[0],
    ).toEqual([
      {
        date_value: '2000-06-03',
        id: 1,
      },
      {
        date_value: '2000-06-03',
        id: 2,
      },
      {
        date_value: '2000-06-03',
        id: 3,
      },
      {
        date_value: '2000-06-03',
        id: 4,
      },
    ]);

    const result = await db.query(sql`
      SELECT * from dates_test_dates;
    `);
    expect(result).toEqual([
      {
        a: new Date('2000-06-03T05:40:10.000Z'),
        b: new Date('2000-06-03T05:40:10.000Z'),
        c: '15:10:10',
        d: 2000,
        id: 1,
      },
      {
        a: new Date('2000-06-02T20:10:10.000Z'),
        b: new Date('2000-06-02T20:10:10.000Z'),
        c: '05:40:10',
        d: 2000,
        id: 2,
      },
    ]);
    expect(
      await db.query(sql`
        SELECT * from dates_test_pure_dates;
      `),
    ).toEqual([
      {
        date_value: new Date('2000-06-02T14:30:00.000Z'),
        id: 1,
      },
      {
        date_value: new Date('2000-06-02T14:30:00.000Z'),
        id: 2,
      },
      {
        date_value: new Date('2000-06-02T14:30:00.000Z'),
        id: 3,
      },
      {
        date_value: new Date('2000-06-03T14:30:00.000Z'),
        id: 4,
      },
    ]);
  });
  await db.dispose();
});

test('DATE as string', async () => {
  const db = connect({dateMode: 'string'});
  await db.query(sql`
    DROP TABLE IF EXISTS dates_test_pure_dates;
    CREATE TABLE dates_test_pure_dates (
      id INT NOT NULL PRIMARY KEY,
      date_value DATE NOT NULL
    );
    INSERT INTO dates_test_pure_dates (id, date_value)
    VALUES (1, ${'2000-06-03'}),
           (2, ${'2000-06-04'});
  `);
  expect(await db.query(sql`SELECT * from dates_test_pure_dates`)).toEqual([
    {
      date_value: '2000-06-03',
      id: 1,
    },
    {
      date_value: '2000-06-04',
      id: 2,
    },
  ]);
  await db.dispose();
});

test('DATE as utc', async () => {
  const db = connect({timeZone: {client: 'utc'}});
  await db.query(sql`
    DROP TABLE IF EXISTS dates_test_pure_dates;
    CREATE TABLE dates_test_pure_dates (
      id INT NOT NULL PRIMARY KEY,
      date_value DATE NOT NULL
    );
    INSERT INTO dates_test_pure_dates (id, date_value)
    VALUES (1, ${'2000-06-03'}),
           (2, ${'2000-06-04'});
  `);
  expect(await db.query(sql`SELECT * from dates_test_pure_dates`)).toEqual([
    {
      date_value: new Date('2000-06-03T00:00:00.000Z'),
      id: 1,
    },
    {
      date_value: new Date('2000-06-04T00:00:00.000Z'),
      id: 2,
    },
  ]);
  await db.dispose();
});
