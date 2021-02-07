import {ConnectionOptions} from 'tls';
import PgDriver from './Driver';
import definePrecondition from './definePrecondition';
import TypeOverrides from './TypeOverrides';
import EventHandlers from './types/EventHandlers';
const {Client} = require('pg');

type SSLConfig = null | {
  allowFallback: boolean;
  connectionOptions: ConnectionOptions;
};

export interface PgOptions {
  user: string | undefined;
  password: string | undefined;
  database: string | undefined;
  connectionTimeoutMillis: number;
  statement_timeout?: number;
  query_timeout?: number;
  idle_in_transaction_session_timeout?: number;
  application_name?: string;
  keepAlive: boolean;
  keepAliveInitialDelayMillis: number;
  types: TypeOverrides;
  hosts: {host: string; port?: number | undefined}[];
  ssl: SSLConfig;
}

export default function createConnectionSource(
  {hosts, ssl, ...partialOptions}: PgOptions,
  handlers: EventHandlers,
  aquireLockTimeoutMilliseconds: number,
) {
  const options = {
    ...partialOptions,
    ...hosts[0],
    ssl: ssl?.connectionOptions ?? false,
  };
  const precondition = definePrecondition(
    async (): Promise<PgDriver> => {
      const start = Date.now();
      let error: {message: string} | undefined;
      let attemptCount = 0;
      do {
        attemptCount++;
        if (attemptCount) {
          await new Promise((resolve) =>
            setTimeout(resolve, attemptCount * 100),
          );
        }

        for (const {host, port} of hosts) {
          options.host = host;
          options.port = port;
          options.ssl = ssl?.connectionOptions ?? false;

          try {
            const connection = new PgDriver(
              new Client(options),
              handlers,
              aquireLockTimeoutMilliseconds,
            );
            await connection.connect();
            return connection;
          } catch (ex) {
            error = ex;
            if (
              options.ssl &&
              ssl?.allowFallback &&
              /the server does not support ssl connections/i.test(
                error!.message,
              )
            ) {
              // The Postgres server does not support SSL and our sslmode is "prefer"
              // (which is the default). In this case we immediately retry without
              // ssl.
              try {
                options.ssl = false;
                const connection = new PgDriver(
                  new Client(options),
                  handlers,
                  aquireLockTimeoutMilliseconds,
                );
                await connection.connect();
                return connection;
              } catch (ex) {
                error = ex;
              }
            }
          }
        }

        // If you try to connect very quickly after postgres boots (e.g. intesting environments)
        // you can get an error of "Connection terminated unexpectedly". For this reason, we retry
        // all possible connections for up to 2 seconds
      } while (Date.now() - start < 2000);
      throw error;
    },
  );

  const getConnection = async (): Promise<PgDriver> => {
    const firstClient = await precondition.callPrecondition();
    if (firstClient) {
      return firstClient;
    } else {
      try {
        const client = new PgDriver(
          new Client(options),
          handlers,
          aquireLockTimeoutMilliseconds,
        );
        await client.connect();
        return client;
      } catch (ex) {
        precondition.resetPrecondition();
        return await getConnection();
      }
    }
  };
  return getConnection;
}
