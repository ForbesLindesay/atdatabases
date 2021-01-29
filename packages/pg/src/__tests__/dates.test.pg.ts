import connect, {sql} from '..';

jest.setTimeout(30000);

const db = connect({
  bigIntMode: 'bigint',
});

beforeAll(async () => {
  await db.query(sql`CREATE SCHEMA dates_test`);
});
afterAll(async () => {
  await db.dispose();
});

test('dates', async () => {
  await db.task(async (db) => {
    expect(await db.query(sql`show timezone;`)).toMatchInlineSnapshot(`
      Array [
        Object {
          "TimeZone": "UTC",
        },
      ]
    `);
    await db.query(sql`
      DROP TABLE IF EXISTS dates_test.dates;
      CREATE TABLE dates_test.dates (
        id INT NOT NULL PRIMARY KEY,
        a TIMESTAMP NOT NULL,
        b TIMESTAMPTZ NOT NULL,
        c TIME NOT NULL,
        d TIMETZ NOT NULL
      );
      DROP TABLE IF EXISTS dates_test.pure_dates;
      CREATE TABLE dates_test.pure_dates (
        id INT NOT NULL PRIMARY KEY,
        date_value DATE NOT NULL
      );
    `);

    const sampleDate = new Date('2000-06-03T05:40:10.123Z');
    await db.query(sql`
      INSERT INTO dates_test.dates (id, a, b, c, d)
      VALUES (1, ${sampleDate}, ${sampleDate}, ${'07:40:10.123+02'}, ${'07:40:10.123+02'}),
            (2, ${'2000-06-03 05:40:10.123'}, ${'2000-06-03 05:40:10.123'}, ${'05:40:10.123'}, ${'05:40:10.123'});
    `);

    expect(
      await db.query(sql`
        SELECT * from dates_test.dates;
      `),
    ).toEqual([
      {
        a: new Date('2000-06-03T05:40:10.123Z'),
        b: new Date('2000-06-03T05:40:10.123Z'),
        c: '07:40:10.123',
        d: '07:40:10.123+02',
        id: 1,
      },
      {
        // these values are surprising
        a: new Date('2000-06-02T20:10:10.123Z'),
        b: new Date('2000-06-03T05:40:10.123Z'),
        c: '05:40:10.123',
        d: '05:40:10.123+00',
        id: 2,
      },
    ]);

    await db.query(sql`
      INSERT INTO dates_test.pure_dates (id, date_value)
      VALUES (1, ${'2000-06-03'}),
            (2, ${new Date('2000-06-03T00:00:00.000Z')}),
            (3, ${new Date('2000-06-03T01:00:00.000Z')}),
            (4, ${new Date('2000-06-03T23:00:00.000Z')});
    `);
    expect(
      await db.query(sql`
        SELECT * from dates_test.pure_dates;
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
