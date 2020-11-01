import RawQueryFunction from '../types/RawQueryFunction';
import TransactionOptions from '../types/TransactionOptions';
import {isolationLevelToString} from '../types/TransactionIsolationLevel';

// N.B. Issuing BEGIN when already inside a transaction block will provoke
// a warning message. The state of the transaction is not affected. To nest
// transactions within a transaction block, use savepoints.

export async function beginTransaction(
  client: {query: RawQueryFunction},
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

export async function rollbackTransaction(client: {query: RawQueryFunction}) {
  await client.query(`ROLLBACK`);
}

export async function commitTransaction(client: {query: RawQueryFunction}) {
  await client.query(`COMMIT`);
}
