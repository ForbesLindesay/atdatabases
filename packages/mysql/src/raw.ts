const mysql: {
  createPool: (opts: any) => Pool;
} = require('mysql2/promise');

// Create the connection pool. The pool-specific settings are the defaults

export interface PoolConnection {
  release(): void;
  destroy(): void;
  query(sql: string, args: any[]): Promise<[unknown[], unknown[]]>;
  execute(sql: string, args: any[]): Promise<unknown>;
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  ping(): Promise<void>;
}
export interface Pool {
  getConnection(): Promise<PoolConnection>;
  query(sql: string, args: any[]): Promise<[unknown[], unknown[]]>;
  execute(sql: string, args: any[]): Promise<unknown>;
  end(): Promise<void>;
}
export default mysql.createPool;
