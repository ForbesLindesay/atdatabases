/**
 * This file handles 33.14 from https://www.postgresql.org/docs/13/libpq-envars.html
 */

const EnvironmentVariables = new Map([
  ['PGHOST', 'host'],

  ['PGHOSTADDR', 'hostaddr'],

  ['PGPORT', 'port'],

  ['PGDATABASE', 'dbname'],

  ['PGUSER', 'user'],

  ['PGPASSWORD', 'password'],

  ['PGPASSFILE', 'passfile'],

  ['PGCHANNELBINDING', 'channel_binding'],

  ['PGSERVICE', 'service'],

  // PGSERVICEFILE specifies the name of the per-user connection service file. If not set, it defaults to ~/.pg_service.conf (see Section 33.16).

  ['PGOPTIONS', 'options'],

  ['PGAPPNAME', 'application_name'],

  // This environment variable is deprecated in favor of the PGSSLMODE variable; setting both variables suppresses the effect of this one.
  // ['PGREQUIRESSL', 'requiressl'],

  ['PGSSLMODE', 'sslmode'],

  ['PGSSLCOMPRESSION', 'sslcompression'],

  ['PGSSLCERT', 'sslcert'],

  ['PGSSLKEY', 'sslkey'],

  ['PGSSLROOTCERT', 'sslrootcert'],

  ['PGSSLCRL', 'sslcrl'],

  ['PGREQUIREPEER', 'requirepeer'],

  ['PGSSLMINPROTOCOLVERSION', 'ssl_min_protocol_version'],

  ['PGSSLMAXPROTOCOLVERSION', 'ssl_min_protocol_version'],

  ['PGGSSENCMODE', 'gssencmode'],

  ['PGKRBSRVNAME', 'krbsrvname'],

  ['PGGSSLIB', 'gsslib'],

  ['PGCONNECT_TIMEOUT', 'connect_timeout'],

  ['PGCLIENTENCODING', 'client_encoding'],

  ['PGTARGETSESSIONATTRS', 'target_session_attrs'],
] as const);
export default EnvironmentVariables;
