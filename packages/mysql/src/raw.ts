import {ReadableOptions} from 'stream';

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
