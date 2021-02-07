export type RawQueryFunction = (
  query: unknown,
  values?: unknown[],
) => Promise<unknown>;

export default interface PgClient {
  query: RawQueryFunction;
  connect(): Promise<void>;
  end(): Promise<void>;

  on(event: 'error', handler: (err: Error) => void): void;
  on(event: 'connect' | 'drain' | 'end', handler: () => void): void;
  on(
    event: 'notification' | 'notice',
    handler: (notificationOrNotice: unknown) => void,
  ): void;

  removeListener(event: 'error', handler: (err: Error) => void): void;
  removeListener(event: 'connect' | 'drain' | 'end', handler: () => void): void;
  removeListener(
    event: 'notification' | 'notice',
    handler: (notificationOrNotice: unknown) => void,
  ): void;

  connection?: {stream?: {destroy?: () => void}};
}
