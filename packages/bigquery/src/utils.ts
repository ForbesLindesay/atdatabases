import {isSqlQuery, SQLQuery} from '@databases/sql';

export function assertSql(query: SQLQuery): void {
  if (!isSqlQuery(query)) {
    throw new Error(
      'Invalid query, you must use @databases/sql to create your queries.',
    );
  }
}
