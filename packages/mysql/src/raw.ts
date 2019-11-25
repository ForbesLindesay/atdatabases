import {ReadableOptions} from 'stream';

const mysql: {
  createPool: (opts: any) => Pool;
} = require('mysql2/promise');

// Create the connection pool. The pool-specific settings are the defaults

// this.on('result', row => {
//   if (!stream.push(row)) {
//     this._connection.pause();
//   }
//   stream.emit('result', row); // replicate old emitter
// });
// this.on('error', err => {
//   stream.emit('error', err); // Pass on any errors
// });
// this.on('end', () => {
//   stream.push(null); // pushing null, indicating EOF
//   stream.emit('close'); // notify readers that query has completed
// });
// this.on('fields', fields => {
//   stream.emit('fields', fields); // replicate old emitter
// });
export interface ColumnDefinition {
  characterSet: number;
  encoding: string;
  name: string;
  columnLength: number;
  columnType: number;
  flags: number;
  decimals: number;
}
export interface QueryCmd {
  on(event: 'result', fn: (row: any) => void): this;
  on(event: 'error', fn: (err: any) => void): this;
  on(event: 'end', fn: () => void): this;
  on(
    event: 'fields',
    fn: (fields: undefined | ColumnDefinition[]) => void,
  ): this;

  // Also emits the "fields" event as above
  stream(options?: ReadableOptions): NodeJS.ReadableStream;
}
export interface CoreConnection {
  query(sql: string, args: any[]): QueryCmd;
  pause(): void;
  resume(): void;
}
export interface PoolConnection {
  readonly connection: CoreConnection;
  release(): void;
  destroy(): void;
  query(
    sql: string,
    args: any[],
  ): Promise<[unknown[], undefined | ColumnDefinition[]]>;
  execute(sql: string, args: any[]): Promise<unknown>;
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  ping(): Promise<void>;
}
export interface Pool {
  getConnection(): Promise<PoolConnection>;
  query(
    sql: string,
    args: any[],
  ): Promise<[unknown[], undefined | ColumnDefinition[]]>;
  execute(sql: string, args: any[]): Promise<unknown>;
  end(): Promise<void>;
}
export default mysql.createPool;
