import {Readable} from 'stream';
import {BaseTransaction} from '@databases/shared';
import sql, {SQLQuery} from '@databases/sql';
import {Transaction as ITransaction} from './types/Queryable';
import PgDriver from './Driver';
import AdvisoryLockKey from './types/AdvisoryLockKey';

export default class Transaction
  extends BaseTransaction<Transaction, PgDriver>
  implements ITransaction
{
  public readonly sql = sql;
  private async _advisoryLock(fn: SQLQuery, key: AdvisoryLockKey) {
    const sqlKey = Array.isArray(key) ? sql`${key[0]}, ${key[1]}` : sql`${key}`;
    const result = await this.query(sql`SELECT ${fn}(${sqlKey}) AS acquired`);
    return Boolean(result[0]?.acquired);
  }
  async advisoryTxLock(key: AdvisoryLockKey): Promise<void> {
    await this._advisoryLock(sql`pg_advisory_xact_lock`, key);
  }
  async advisoryTxLockShared(key: AdvisoryLockKey): Promise<void> {
    await this._advisoryLock(sql`pg_advisory_xact_lock_shared`, key);
  }
  async tryAdvisoryTxLock(key: AdvisoryLockKey): Promise<boolean> {
    return await this._advisoryLock(sql`pg_try_advisory_xact_lock`, key);
  }
  async tryAdvisoryTxLockShared(key: AdvisoryLockKey): Promise<boolean> {
    return await this._advisoryLock(sql`pg_try_advisory_xact_lock_shared`, key);
  }
  queryNodeStream(
    query: SQLQuery,
    options: {highWaterMark?: number} = {},
  ): Readable {
    return this._driver.queryNodeStream(query, options);
  }
}
