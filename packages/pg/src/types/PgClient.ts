export type RawQueryFunction = (
  query: unknown,
  values?: unknown[],
) => Promise<unknown>;

export default interface PgClient {
  query: RawQueryFunction;
  connect(): Promise<void>;
  end(): Promise<void>;

  on(event: 'error', handler: (err: Error) => void): void;
  on(event: 'connect', handler: () => void): void;
  on(event: 'drain', handler: () => void): void;
  on(event: 'end', handler: () => void): void;
  on(event: 'notification', handler: (notification: unknown) => void): void;
  on(event: 'notice', handler: (notice: unknown) => void): void;

  removeListener(event: 'error', handler: (err: Error) => void): void;
  removeListener(event: 'connect', handler: () => void): void;
  removeListener(event: 'drain', handler: () => void): void;
  removeListener(event: 'end', handler: () => void): void;
  removeListener(
    event: 'notification',
    handler: (notification: unknown) => void,
  ): void;
  removeListener(event: 'notice', handler: (notice: unknown) => void): void;

  connection?: {stream?: {destroy?: () => void}};
}
