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

test(`Basic Delete`, async () => {
  const mock = {query: jest.fn()};

  const deleteNoRecords = users.delete(false);
  await deleteNoRecords.executeQuery(mock);
  expect(mock.query).not.toBeCalled();
  expect(deleteNoRecords.toSql()).toBe(null);
  expect(await mockResult<void>(deleteNoRecords)).toBe(undefined);

  const deleteOne = users.delete({id: 1});

  expect(
    await mockResult<void>(
      deleteOne,
      `DELETE FROM users WHERE "id"=\${ 1 }`,
      [],
    ),
  ).toBe(undefined);

  const deleteReturningStar = deleteOne.returning();
  expect(
    await mockResult<DbUser | undefined>(
      deleteReturningStar.one(),
      `DELETE FROM users WHERE "id"=\${ 1 } RETURNING *`,
      [{id: 1, username: 'deleted_username', profile_image_url: null}],
    ),
  ).toEqual({id: 1, username: 'deleted_username', profile_image_url: null});

  const deleteReturningId = deleteOne.returning(`id`);
  expect(
    await mockResult<{id: number}[]>(
      deleteReturningId,
      `DELETE FROM users WHERE "id"=\${ 1 } RETURNING "id"`,
      [{id: 1}],
    ),
  ).toEqual([{id: 1}]);

  const deleteReturningCount = deleteOne.returningCount();
  expect(
    await mockResult<number>(
      deleteReturningCount,
      `DELETE FROM users WHERE "id"=\${ 1 } RETURNING (COUNT(*))::INT AS row_count`,
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
