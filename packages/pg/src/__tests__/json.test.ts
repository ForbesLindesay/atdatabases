import connect, {sql} from '../';
import {SQLQuery} from 'packages/pg/lib';

jest.setTimeout(30000);

const db = connect();

test('streaming', async () => {
  await db.query(sql`CREATE SCHEMA json_test`);
  await db.query(
    sql`
      CREATE TABLE json_test.users (
        user_id BIGSERIAL NOT NULL PRIMARY KEY,
        display_name TEXT NOT NULL,
        manager_id BIGINT NULL REFERENCES json_test.users(user_id)
      );
      CREATE TABLE json_test.teams (
        team_id BIGSERIAL NOT NULL PRIMARY KEY,
        display_name TEXT NOT NULL
      );
      CREATE TABLE json_test.user_teams (
        user_id BIGINT NOT NULL REFERENCES json_test.users,
        team_id BIGINT NOT NULL REFERENCES json_test.teams,
        PRIMARY KEY(user_id, team_id)
      );

      INSERT INTO json_test.users
        (user_id, display_name, manager_id)
      VALUES
        (1, 'Forbes', NULL), (2, 'John', NULL), (3, 'Joe', 1);

      INSERT INTO json_test.teams
        (team_id, display_name)
      VALUES
        (1, 'Awesome Team'), (2, 'Team of One');

      INSERT INTO json_test.user_teams
        (user_id, team_id)
      VALUES
        (1, 1), (2, 1), (1, 2);

    `,
  );
  const nested = await Promise.all(
    (await db.query(
      sql`
              SELECT u.user_id AS id, u.display_name, u.manager_id
              FROM json_test.users u
            `,
    )).map(async ({manager_id, ...user}) => ({
      ...user,
      manager:
        (await db.query(
          sql`
                  SELECT u.user_id AS id, u.display_name
                  FROM json_test.users u
                  WHERE u.user_id=${manager_id}
                `,
        ))[0] || null,
      teams: await db.query(
        sql`
                SELECT t.team_id AS id, t.display_name
                FROM json_test.user_teams ut
                JOIN json_test.teams t USING (team_id)
                WHERE ut.user_id = ${user.id}
              `,
      ),
    })),
  );
  expect(nested).toMatchInlineSnapshot(`
Array [
  Object {
    "display_name": "Forbes",
    "id": 1,
    "manager": null,
    "teams": Array [
      Object {
        "display_name": "Awesome Team",
        "id": 1,
      },
      Object {
        "display_name": "Team of One",
        "id": 2,
      },
    ],
  },
  Object {
    "display_name": "John",
    "id": 2,
    "manager": null,
    "teams": Array [
      Object {
        "display_name": "Awesome Team",
        "id": 1,
      },
    ],
  },
  Object {
    "display_name": "Joe",
    "id": 3,
    "manager": Object {
      "display_name": "Forbes",
      "id": 1,
    },
    "teams": Array [],
  },
]
`);
  expect(
    await db.query(
      sql`
        SELECT
          u.user_id AS id,
          u.display_name,
          coalesce(
            (
              SELECT array_to_json(array_agg(row_to_json(x)))
              FROM (
                SELECT t.team_id AS id, t.display_name FROM json_test.user_teams ut JOIN json_test.teams t USING (team_id) WHERE ut.user_id = u.user_id
              ) x
            ),
            '[]'
          ) AS teams,
          (
            SELECT row_to_json(x) FROM
            (
              SELECT m.user_id AS id, m.display_name
              FROM json_test.users m WHERE m.user_id = u.manager_id
            ) x
          )
          AS manager
        FROM json_test.users u;
    `,
    ),
  ).toEqual(nested);

  expect(
    await db.query(
      sql`
        SELECT
          u.user_id AS id,
          u.display_name,
          ${nestQuery(
            sql`
              SELECT t.team_id AS id, t.display_name
              FROM json_test.user_teams ut
              JOIN json_test.teams t USING (team_id)
              WHERE ut.user_id = u.user_id
            `,
          )} AS teams,
          ${nestQuerySingle(
            sql`
              SELECT m.user_id AS id, m.display_name
              FROM json_test.users m WHERE m.user_id = u.manager_id
            `,
          )} AS manager
        FROM json_test.users u;
    `,
    ),
  ).toEqual(nested);

  function nestQuerySingle(query: SQLQuery) {
    return sql`
      (SELECT row_to_json(x) FROM (${query}) x)
    `;
  }
  function nestQuery(query: SQLQuery) {
    return sql`
      coalesce(
        (
          SELECT array_to_json(array_agg(row_to_json(x)))
          FROM (${query}) x
        ),
        '[]'
      )
    `;
  }
});
