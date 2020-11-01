import RawQueryFunction from '../types/RawQueryFunction';

// Savepoints can be used to handle errors within a transaction:
// https://www.enterprisedb.com/postgres-tutorials/how-work-postgresql-transactions

export async function createSavepoint(
  client: {query: RawQueryFunction},
  savepointName: string,
) {
  await client.query(`SAVEPOINT ${savepointName}`);
}

export async function rollbackSavepoint(
  client: {query: RawQueryFunction},
  savepointName: string,
) {
  await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
}

export async function commitSavepoint(
  client: {query: RawQueryFunction},
  savepointName: string,
) {
  await client.query(`RELEASE SAVEPOINT ${savepointName}`);
}
