import {escapePostgresIdentifier} from '@databases/escape-identifier';
import {SQLQuery, sql} from '@databases/pg';
import {columns} from '../implementation/Columns';
import createTableApi from '../implementation/Table';
import {TypedDatabaseQuery} from '../types/TypedDatabaseQuery';

interface DbUser {
  id: number;
  username: string;
  profile_image_url: string | null;
}

const users = createTableApi<DbUser>('users', sql`users`, columns(`users`));

const testFormat = {
  escapeIdentifier: escapePostgresIdentifier,
  formatValue: (value: unknown) => ({
    placeholder: '${ ' + JSON.stringify(value) + ' }',
    value: undefined,
  }),
};

test(`Basic Update`, async () => {
  const mock = {query: jest.fn()};

  const updateNoColumns = users.update(true, {});
  await updateNoColumns.executeQuery(mock);
  expect(mock.query).not.toBeCalled();
  expect(updateNoColumns.toSql()).toBe(null);
  expect(await mockResult<void>(updateNoColumns)).toBe(undefined);

  const updateNoRecords = users.update(false, {username: 'updated_username'});
  await updateNoRecords.executeQuery(mock);
  expect(mock.query).not.toBeCalled();
  expect(updateNoRecords.toSql()).toBe(null);
  expect(await mockResult<void>(updateNoRecords)).toBe(undefined);

  const updateOne = users.update({id: 1}, {username: 'updated_username'});

  expect(
    await mockResult<void>(
      updateOne,
      `UPDATE users SET "username"=\${ "updated_username" } WHERE "id"=\${ 1 }`,
      [],
    ),
  ).toBe(undefined);

  const updateReturningStar = updateOne.returning();
  expect(
    await mockResult<DbUser | undefined>(
      updateReturningStar.one(),
      `UPDATE users SET "username"=\${ "updated_username" } WHERE "id"=\${ 1 } RETURNING *`,
      [{id: 1, username: 'updated_username', profile_image_url: null}],
    ),
  ).toEqual({id: 1, username: 'updated_username', profile_image_url: null});

  const updateReturningId = updateOne.returning(`id`);
  expect(
    await mockResult<{id: number}[]>(
      updateReturningId,
      `UPDATE users SET "username"=\${ "updated_username" } WHERE "id"=\${ 1 } RETURNING "id"`,
      [{id: 1}],
    ),
  ).toEqual([{id: 1}]);

  const updateReturningCount = updateOne.returningCount();
  expect(
    await mockResult<number>(
      updateReturningCount,
      `UPDATE users SET "username"=\${ "updated_username" } WHERE "id"=\${ 1 } RETURNING (COUNT(*))::INT AS row_count`,
      [{row_count: 1}],
    ),
  ).toBe(1);
});

async function mockResult<T>(
  query: TypedDatabaseQuery<T>,
  expectedQuery?: string,
  results?: any[],
): Promise<T> {
  if ((expectedQuery === undefined) !== (results === undefined)) {
    throw new Error(
      `Mock results should have either an expected query and results, or neither.`,
    );
  }
  let called = false;
  const result = await query.executeQuery({
    query: async (q: SQLQuery) => {
      if (expectedQuery === undefined || results === undefined) {
        throw new Error(`Did not expect query to be called`);
      }
      called = true;
      expect(q.format(testFormat).text).toEqual(expectedQuery);
      return results;
    },
  });
  if (expectedQuery) {
    expect(called).toBe(true);
  }
  return result;
}
