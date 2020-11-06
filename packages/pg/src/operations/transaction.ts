import PgClient from '../types/PgClient';
import TransactionOptions from '../types/TransactionOptions';
import {isolationLevelToString} from '../types/IsolationLevel';

// N.B. Issuing BEGIN when already inside a transaction block will provoke
// a warning message. The state of the transaction is not affected. To nest
// transactions within a transaction block, use savepoints.

export async function beginTransaction(
  client: PgClient,
  options: TransactionOptions,
) {
  const parameters = [];
  if (options.isolationLevel) {
    parameters.push(isolationLevelToString(options.isolationLevel));
  }
  if (options.readOnly) {
    parameters.push('READ ONLY');
  } else if (options.readOnly === false) {
    parameters.push('READ WRITE');
  }
  if (options.deferrable) {
    parameters.push('DEFERRABLE');
  } else if (options.deferrable === false) {
    parameters.push('NOT DEFERRABLE');
  }

  if (parameters.length) {
    await client.query(`BEGIN ${parameters.join(', ')}`);
  } else {
    await client.query(`BEGIN`);
  }
}

export async function rollbackTransaction(client: PgClient) {
  await client.query(`ROLLBACK`);
}

export async function commitTransaction(client: PgClient) {
  await client.query(`COMMIT`);
}
