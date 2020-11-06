import PgClient from '../types/PgClient';

// Savepoints can be used to handle errors within a transaction:
// https://www.enterprisedb.com/postgres-tutorials/how-work-postgresql-transactions

export async function createSavepoint(client: PgClient, savepointName: string) {
  await client.query(`SAVEPOINT ${savepointName}`);
}

export async function rollbackSavepoint(
  client: PgClient,
  savepointName: string,
) {
  await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
}

export async function commitSavepoint(client: PgClient, savepointName: string) {
  await client.query(`RELEASE SAVEPOINT ${savepointName}`);
}
