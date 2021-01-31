export type RawQueryFunction = (
  query: unknown,
  values?: unknown[],
) => Promise<unknown>;

export default interface PgClient {
  query: RawQueryFunction;
  connect(): Promise<void>;
  end(): Promise<void>;
}
