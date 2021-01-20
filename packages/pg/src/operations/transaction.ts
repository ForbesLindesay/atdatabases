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

  try {
    if (parameters.length) {
      await client.query(`BEGIN ${parameters.join(', ')}`);
    } else {
      await client.query(`BEGIN`);
    }
  } catch (ex) {
    throw Object.assign(new Error(ex.message), ex);
  }
}

export async function rollbackTransaction(client: PgClient) {
  try {
    await client.query(`ROLLBACK`);
  } catch (ex) {
    throw Object.assign(new Error(ex.message), ex);
  }
}

export async function commitTransaction(client: PgClient) {
  try {
    await client.query(`COMMIT`);
  } catch (ex) {
    throw Object.assign(new Error(ex.message), ex);
  }
}
