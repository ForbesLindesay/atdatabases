/**
 * This file handles 33.1.2 from https://www.postgresql.org/docs/13/libpq-connect.html
 */

import EnvironmentVariables from './EnvironmentVariables';

export interface ConfigurationOptions {
  unrecognisedOptionMode:
    | 'ignore'
    | 'warn'
    | 'error'
    | ((key: string, value: string) => void);
  invalidOptionMode: 'ignore' | 'warn' | 'error';
  env: {
    readonly [key: string]: string | undefined;
  };
}

interface ConfigurationOptionsWithEnvVarName extends ConfigurationOptions {
  envVarName: string | null;
}

export class ConfigurationBuilder {
  private readonly _config: Partial<Configuration> &
    Pick<Configuration, 'host' | 'hostaddr' | 'port'> = {
    host: [],
    hostaddr: [],
    port: [],
  };
  private readonly _options: ConfigurationOptionsWithEnvVarName;
  constructor(options: ConfigurationOptions) {
    this._options = {...options, envVarName: null};
  }
  getConfig(): Configuration {
    for (const [envVarName, configParamName] of EnvironmentVariables) {
      const currentValue = this._config[configParamName];
      if (
        !currentValue ||
        (Array.isArray(currentValue) && currentValue.length === 0)
      ) {
        const envVarValue = this._options.env[envVarName];
        if (envVarValue) {
          try {
            this._options.envVarName = envVarName;
            this.set(configParamName, envVarValue);
          } finally {
            this._options.envVarName = null;
          }
        }
      }
    }
    if (!this._config.sslmode) {
      const envVarValue = this._options.env.PGREQUIRESSL;
      if (envVarValue) {
        try {
          this._options.envVarName = 'PGREQUIRESSL';
          this.set('requiressl', envVarValue);
        } finally {
          this._options.envVarName = null;
        }
      }
    }
    return {
      ...this._config,
    };
  }
  set(paramName: string, paramValue: string) {
    switch (paramName) {
      // Non standard parameters
      case 'ssl':
        // Non standard param for compatability with 'pg' npm package
        if (!this._config.sslmode) {
          parseEnum(this._options, [
            [['true', '1'], 'require'],
            ['0', 'disable'],
          ] as const)(
            (sslmode) => (this._config.sslmode = sslmode),
            'ssl',
            paramValue,
          );
        }
        break;
      // standard parameters
      case 'host':
        for (const val of paramValue.split(',')) {
          this._config.host.push(val);
        }
        break;
      case 'hostaddr':
        for (const val of paramValue.split(',')) {
          this._config.hostaddr.push(val);
        }
        break;
      case 'port':
        for (const val of paramValue.split(',')) {
          parseInteger(
            this._options,
            (port) => this._config.port.push(port),
            'port',
            val,
          );
        }
        break;
      case 'dbname':
        this._config.dbname = paramValue;
        break;
      case 'user':
        this._config.user = paramValue;
        break;
      case 'password':
        this._config.password = paramValue;
        break;
      case 'passfile':
        this._config.passfile = paramValue;
        break;
      case 'connect_timeout':
        parseInteger(
          this._options,
          this._config,
          'connect_timeout',
          paramValue,
          'seconds',
        );
        if (this._config.connect_timeout && this._config.connect_timeout < 2) {
          this._config.connect_timeout = 2;
        }
        break;
      case 'client_encoding':
        // TODO: handle auto?
        this._config.client_encoding = paramValue;
        break;
      case 'options':
        this._config.options = paramValue;
        break;
      case 'application_name':
        this._config.application_name = paramValue;
        break;
      case 'fallback_application_name':
        this._config.fallback_application_name = paramValue;
        break;
      case 'keepalives':
        parseEnum(this._options, [
          ['1', true],
          ['0', false],
        ] as const)(this._config, 'keepalives', paramValue);
        break;
      case 'keepalives_idle':
        parseInteger(
          this._options,
          this._config,
          'keepalives_idle',
          paramValue,
          'seconds',
        );
        break;
      case 'keepalives_interval':
        parseInteger(
          this._options,
          this._config,
          'keepalives_interval',
          paramValue,
          'seconds',
        );
        break;
      case 'keepalives_count':
        parseInteger(
          this._options,
          this._config,
          'keepalives_count',
          paramValue,
        );
        break;
      case 'tcp_user_timeout':
        parseInteger(
          this._options,
          this._config,
          'tcp_user_timeout',
          paramValue,
          'milliseconds',
        );
        break;
      case 'tty':
        // Ignored (formerly, this specified where to send server debug output).
        break;
      case 'replication':
        parseEnum<boolean | 'database'>(this._options, [
          [['true', 'on', 'yes', '1'], true],
          [['false', 'off', 'no', '0'], false],
          ['database', 'database'],
        ] as const)(this._config, 'replication', paramValue);
        break;
      case 'gssencmode':
        parseEnum(this._options, [
          ['disable', 'disable'],
          ['prefer', 'prefer'],
          ['require', 'require'],
        ] as const)(this._config, 'gssencmode', paramValue);
        break;
      case 'sslmode':
        parseEnum(this._options, [
          ['disable', 'disable'],
          ['allow', 'allow'],
          ['prefer', 'prefer'],
          ['require', 'require'],
          ['verify-ca', 'verify-ca'],
          ['verify-full', 'verify-full'],
          ['no-verify', 'no-verify'],
        ] as const)(this._config, 'sslmode', paramValue);
        break;
      case 'requiressl':
        // This option is deprecated in favor of the sslmode setting.
        if (!this._config.sslmode) {
          parseEnum(this._options, [
            ['1', 'require'],
            ['0', 'prefer'],
          ] as const)(
            (sslmode) => (this._config.sslmode = sslmode),
            'requiressl',
            paramValue,
          );
        }
        break;
      case 'sslcompression':
        parseEnum(this._options, [
          ['1', true],
          ['0', false],
        ] as const)(this._config, 'sslcompression', paramValue);
        break;
      case 'sslcert':
        this._config.sslcert = paramValue;
        break;
      case 'sslkey':
        this._config.sslkey = paramValue;
        break;
      case 'sslpassword':
        this._config.sslpassword = paramValue;
        break;
      case 'sslrootcert':
        this._config.sslrootcert = paramValue;
        break;
      case 'sslcrl':
        this._config.sslcrl = paramValue;
        break;
      case 'requirepeer':
        this._config.requirepeer = paramValue;
        break;
      case 'ssl_min_protocol_version':
        parseEnum(this._options, [
          ['TLSv1', 'TLSv1'],
          ['TLSv1.1', 'TLSv1.1'],
          ['TLSv1.2', 'TLSv1.2'],
          ['TLSv1.3', 'TLSv1.3'],
        ] as const)(this._config, 'ssl_min_protocol_version', paramValue);
        break;
      case 'ssl_max_protocol_version':
        parseEnum(this._options, [
          ['TLSv1', 'TLSv1'],
          ['TLSv1.1', 'TLSv1.1'],
          ['TLSv1.2', 'TLSv1.2'],
          ['TLSv1.3', 'TLSv1.3'],
        ] as const)(this._config, 'ssl_max_protocol_version', paramValue);
        break;
      case 'krbsrvname':
        this._config.krbsrvname = paramValue;
        break;
      case 'gsslib':
        this._config.gsslib = paramValue;
        break;
      case 'service':
        this._config.service = paramValue;
        break;
      case 'target_session_attrs':
        parseEnum(this._options, [
          ['read-write', 'read-write'],
          ['any', 'any'],
        ] as const)(this._config, 'target_session_attrs', paramValue);
        break;
      default:
        if (this._options.envVarName) {
          throw new Error(
            `The environment variable "${this._options.envVarName}" was mapped to an unrecognized parameter name, "${paramName}".  This is probably a bug in @databases/pg-connection-string, not a mistake in your config. Please open an issue at https://github.com/ForbesLindesay/atdatabases/issues to report this.`,
          );
        } else if (this._options.unrecognisedOptionMode === 'error') {
          throw new Error(
            `Unrecognised option in connection string: ${paramName}`,
          );
        } else if (this._options.unrecognisedOptionMode === 'warn') {
          console.warn(
            `Warning: Ignoring unrecognised option in connection string: ${paramName}`,
          );
        } else if (typeof this._options.unrecognisedOptionMode === 'function') {
          this._options.unrecognisedOptionMode(paramName, paramValue);
        }
        break;
    }
  }
}

export default interface Configuration {
  /**
   * Name of host to connect to. If a host name looks like an absolute
   * path name, it specifies Unix-domain communication rather than TCP/IP
   * communication; the value is the name of the directory in which the
   * socket file is stored. (On Unix, an absolute path name begins with a
   * slash. On Windows, paths starting with drive letters are also recognized.)
   * The default behavior when host is not specified, or is empty, is to
   * connect to a Unix-domain socket in /tmp (or whatever socket directory was
   * specified when PostgreSQL was built). On Windows and on machines without
   * Unix-domain sockets, the default is to connect to localhost.
   *
   * A comma-separated list of host names is also accepted, in which case each
   * host name in the list is tried in order; an empty item in the list selects
   * the default behavior as explained above. See Section 33.1.1.3 for details.
   */
  host: string[];
  /**
   * Numeric IP address of host to connect to. This should be in the standard IPv4
   * address format, e.g., 172.28.40.9. If your machine supports IPv6, you can also
   * use those addresses. TCP/IP communication is always used when a nonempty string
   * is specified for this parameter. If this parameter is not specified, the value
   * of host will be looked up to find the corresponding IP address — or, if host
   * specifies an IP address, that value will be used directly.
   *
   * A comma-separated list of hostaddr values is also accepted, in which case each
   * host in the list is tried in order. An empty item in the list causes the corresponding
   * host name to be used, or the default host name if that is empty as well. See
   * Section 33.1.1.3 for details.
   */
  hostaddr: string[];
  /**
   * Port number to connect to at the server host, or socket file name extension for
   * Unix-domain connections. If multiple hosts were given in the host or hostaddr
   * parameters, this parameter may specify a comma-separated list of ports of the same
   * length as the host list, or it may specify a single port number to be used for all
   * hosts. An empty string, or an empty item in a comma-separated list, specifies the
   * default port number established when PostgreSQL was built.
   */
  port: (number | null)[];
  /**
   * The database name. Defaults to be the same as the user name.
   * In certain contexts, the value is checked for extended formats;
   * see Section 33.1.1 for more details on those.
   */
  dbname?: string;
  /**
   * PostgreSQL user name to connect as. Defaults to be the same as the
   * operating system name of the user running the application.
   */
  user?: string;
  /**
   * Password to be used if the server demands password authentication.
   */
  password?: string;
  /**
   * Specifies the name of the file used to store passwords (see Section 33.15).
   * Defaults to ~/.pgpass, or %APPDATA%\postgresql\pgpass.conf on Microsoft Windows.
   * (No error is reported if this file does not exist.)
   */
  passfile?: string;
  /**
   * This option controls the client's use of channel binding. A
   * setting of require means that the connection must employ channel
   * binding, prefer means that the client will choose channel binding
   * if available, and disable prevents the use of channel binding.
   * The default is prefer if PostgreSQL is compiled with SSL support;
   * otherwise the default is disable.
   *
   * Channel binding is a method for the server to authenticate itself
   * to the client. It is only supported over SSL connections with
   * PostgreSQL 11 or later servers using the SCRAM authentication
   * method.
   */
  channel_binding?: string;
  /**
   * Maximum time to wait while connecting, in seconds (write as a decimal integer, e.g., 10).
   * Zero, negative, or not specified means wait indefinitely. The minimum allowed timeout is
   * 2 seconds, therefore a value of 1 is interpreted as 2. This timeout applies separately to
   * each host name or IP address. For example, if you specify two hosts and connect_timeout is
   * 5, each host will time out if no connection is made within 5 seconds, so the total time
   * spent waiting for a connection might be up to 10 seconds.
   */
  connect_timeout?: number;
  /**
   * This sets the client_encoding configuration parameter for this connection. In addition to the
   * values accepted by the corresponding server option, you can use auto to determine the right
   * encoding from the current locale in the client (LC_CTYPE environment variable on Unix systems).
   */
  client_encoding?: string;
  /**
   * Specifies command-line options to send to the server at connection start. For example,
   * setting this to -c geqo=off sets the session's value of the geqo parameter to off. Spaces
   * within this string are considered to separate command-line arguments, unless escaped
   * with a backslash (\); write \\ to represent a literal backslash. For a detailed discussion
   * of the available options, consult Chapter 19.
   */
  options?: string;
  /**
   * Specifies a value for the application_name configuration parameter.
   */
  application_name?: string;
  /**
   * Specifies a fallback value for the application_name configuration parameter. This value will
   * be used if no value has been given for application_name via a connection parameter or the
   * PGAPPNAME environment variable. Specifying a fallback name is useful in generic utility programs
   * that wish to set a default application name but allow it to be overridden by the user.
   */
  fallback_application_name?: string;
  /**
   * Controls whether client-side TCP keepalives are used. The default value is 1, meaning on, but
   * you can change this to 0, meaning off, if keepalives are not wanted. This parameter is ignored
   * for connections made via a Unix-domain socket.
   */
  keepalives?: boolean;
  /**
   * Controls the number of seconds of inactivity after which TCP should send a keepalive message
   * to the server. A value of zero uses the system default. This parameter is ignored for
   * connections made via a Unix-domain socket, or if keepalives are disabled. It is only supported
   * on systems where TCP_KEEPIDLE or an equivalent socket option is available, and on Windows; on
   * other systems, it has no effect.
   */
  keepalives_idle?: number;
  /**
   * Controls the number of seconds after which a TCP keepalive message that is not acknowledged by
   * the server should be retransmitted. A value of zero uses the system default. This parameter is
   * ignored for connections made via a Unix-domain socket, or if keepalives are disabled. It is
   * only supported on systems where TCP_KEEPINTVL or an equivalent socket option is available, and
   * on Windows; on other systems, it has no effect.
   */
  keepalives_interval?: number;
  /**
   * Controls the number of TCP keepalives that can be lost before the client's connection to the
   * server is considered dead. A value of zero uses the system default. This parameter is ignored
   * for connections made via a Unix-domain socket, or if keepalives are disabled. It is only supported
   * on systems where TCP_KEEPCNT or an equivalent socket option is available; on other systems,
   * it has no effect.
   */
  keepalives_count?: number;
  /**
   * Controls the number of milliseconds that transmitted data may remain unacknowledged before a
   * connection is forcibly closed. A value of zero uses the system default. This parameter is ignored
   * for connections made via a Unix-domain socket. It is only supported on systems where TCP_USER_TIMEOUT
   * is available; on other systems, it has no effect.
   */
  tcp_user_timeout?: number;
  /**
   * This option determines whether the connection should use the replication protocol instead of the
   * normal protocol. This is what PostgreSQL replication connections as well as tools such as
   * pg_basebackup use internally, but it can also be used by third-party applications. For a description
   * of the replication protocol, consult Section 52.4.
   */
  replication?: boolean | 'database';
  /**
   * This option determines whether or with what priority a secure GSS TCP/IP connection will be
   * negotiated with the server. There are three modes, "prefer" is the default.
   */
  gssencmode?: 'disable' | 'prefer' | 'require';
  /**
   * This option determines whether or with what priority a secure SSL TCP/IP connection will be
   * negotiated with the server. There are six modes, "prefer" is the default.
   *
   * We also allow for a non-standard "no-verify" option
   */
  sslmode?:
    | 'disable'
    | 'allow'
    | 'prefer'
    | 'require'
    | 'verify-ca'
    | 'verify-full'
    | 'no-verify';
  /**
   * If set to 1, data sent over SSL connections will be compressed. If set to 0, compression will
   * be disabled. The default is 0. This parameter is ignored if a connection without SSL is made.
   *
   * SSL compression is nowadays considered insecure and its use is no longer recommended. OpenSSL
   * 1.1.0 disables compression by default, and many operating system distributions disable it in
   * prior versions as well, so setting this parameter to on will not have any effect if the server
   * does not accept compression.
   *
   * If security is not a primary concern, compression can improve throughput if the network is the
   * bottleneck. Disabling compression can improve response time and throughput if CPU performance
   * is the limiting factor.
   */
  sslcompression?: boolean;
  /**
   * This parameter specifies the file name of the client SSL certificate, replacing the default
   * ~/.postgresql/postgresql.crt. This parameter is ignored if an SSL connection is not made.
   */
  sslcert?: string;
  /**
   * This parameter specifies the location for the secret key used for the client certificate. It
   * can either specify a file name that will be used instead of the default ~/.postgresql/postgresql.key,
   * or it can specify a key obtained from an external “engine” (engines are OpenSSL loadable modules).
   * An external engine specification should consist of a colon-separated engine name and an engine-specific
   * key identifier. This parameter is ignored if an SSL connection is not made.
   */
  sslkey?: string;
  /**
   * This parameter specifies the password for the secret key specified in sslkey, allowing client
   * certificate private keys to be stored in encrypted form on disk even when interactive passphrase
   * input is not practical.
   */
  sslpassword?: string;
  /**
   * This parameter specifies the name of a file containing SSL certificate authority (CA) certificate(s).
   * If the file exists, the server's certificate will be verified to be signed by one of these authorities.
   * The default is ~/.postgresql/root.crt.
   */
  sslrootcert?: string;
  /**
   * This parameter specifies the file name of the SSL certificate revocation list (CRL). Certificates
   * listed in this file, if it exists, will be rejected while attempting to authenticate the server's
   * certificate. The default is ~/.postgresql/root.crl.
   */
  sslcrl?: string;
  /**
   * This parameter specifies the operating-system user name of the server, for example
   * requirepeer=postgres. When making a Unix-domain socket connection, if this parameter
   * is set, the client checks at the beginning of the connection that the server process
   * is running under the specified user name; if it is not, the connection is aborted
   * with an error. This parameter can be used to provide server authentication similar to
   * that available with SSL certificates on TCP/IP connections. (Note that if the Unix-domain
   * socket is in /tmp or another publicly writable location, any user could start a server
   * listening there. Use this parameter to ensure that you are connected to a server run by
   * a trusted user.) This option is only supported on platforms for which the peer authentication
   * method is implemented; see Section 20.9.
   */
  requirepeer?: string;
  /**
   * This parameter specifies the minimum SSL/TLS protocol version to allow for the connection.
   * Valid values are TLSv1, TLSv1.1, TLSv1.2 and TLSv1.3. The supported protocols depend on
   * the version of OpenSSL used, older versions not supporting the most modern protocol versions.
   * If not specified, the default is TLSv1.2, which satisfies industry best practices as of this
   * writing.
   */
  ssl_min_protocol_version?: 'TLSv1' | 'TLSv1.1' | 'TLSv1.2' | 'TLSv1.3';
  /**
   * This parameter specifies the maximum SSL/TLS protocol version to allow for the connection.
   * Valid values are TLSv1, TLSv1.1, TLSv1.2 and TLSv1.3. The supported protocols depend on the
   * version of OpenSSL used, older versions not supporting the most modern protocol versions.
   * If not set, this parameter is ignored and the connection will use the maximum bound defined
   * by the backend, if set. Setting the maximum protocol version is mainly useful for testing
   * or if some component has issues working with a newer protocol.
   */
  ssl_max_protocol_version?: 'TLSv1' | 'TLSv1.1' | 'TLSv1.2' | 'TLSv1.3';
  /**
   * Kerberos service name to use when authenticating with GSSAPI. This must match the service
   * name specified in the server configuration for Kerberos authentication to succeed. (See also
   * Section 20.6.)
   */
  krbsrvname?: string;
  /**
   * GSS library to use for GSSAPI authentication. Currently this is disregarded except on
   * Windows builds that include both GSSAPI and SSPI support. In that case, set this to gssapi
   * to cause libpq to use the GSSAPI library for authentication instead of the default SSPI.
   */
  gsslib?: string;
  /**
   * Service name to use for additional parameters. It specifies a service name in pg_service.conf
   * that holds additional connection parameters. This allows applications to specify only a
   * service name so connection parameters can be centrally maintained. See Section 33.16.
   */
  service?: string;
  /**
   * If this parameter is set to read-write, only a connection in which read-write transactions
   * are accepted by default is considered acceptable. The query SHOW transaction_read_only will
   * be sent upon any successful connection; if it returns on, the connection will be closed. If
   * multiple hosts were specified in the connection string, any remaining servers will be tried
   * just as if the connection attempt had failed. The default value of this parameter, any, regards
   * all connections as acceptable.
   */
  target_session_attrs?: 'any' | 'read-write';
}

function parseInteger<TKey extends string>(
  options: ConfigurationOptionsWithEnvVarName,
  obj: {[key in TKey]?: number} | ((value: number) => void),
  paramName: TKey,
  value: string,
  unit?: string,
) {
  if (!/^\d+$/.test(value)) {
    if (options.invalidOptionMode === 'error') {
      throw new Error(
        `Expected "${options.envVarName ?? paramName}" to be an integer${
          unit ? ` in ${unit}` : ``
        }`,
      );
    } else if (options.invalidOptionMode === 'warn') {
      console.warn(
        `Warning: Expected "${
          options.envVarName ?? paramName
        }" to be an integer${
          unit ? ` in ${unit}` : ``
        } - ignoring invalid value!!`,
      );
    }
    return;
  }
  const val = parseInt(value, 10);
  if (typeof obj === 'function') {
    obj(val);
  } else {
    if (val > 0) {
      obj[paramName] = val;
    } else if (paramName in obj) {
      delete obj[paramName];
    }
  }
}

function parseEnum<TValue>(
  options: ConfigurationOptionsWithEnvVarName,
  mapping: readonly (readonly [string | readonly string[], TValue])[],
) {
  return <TKey extends string>(
    obj: {[key in TKey]?: TValue} | ((value: TValue) => void),
    paramName: TKey,
    value: string,
  ) => {
    for (const [keys, outputValue] of mapping) {
      if (typeof keys === 'string' ? value === keys : keys.includes(value)) {
        if (typeof obj === 'function') {
          obj(outputValue);
        } else {
          obj[paramName] = outputValue;
        }
        return;
      }
    }
    if (options.invalidOptionMode === 'error') {
      throw new Error(
        `Expected "${
          options.envVarName ?? paramName
        }" to be one of ${mapping
          .map((value) =>
            typeof value === 'string'
              ? `"${value}"`
              : value.map((v) => `"${v}"`).join(', '),
          )
          .join(', ')}`,
      );
    } else if (options.invalidOptionMode === 'warn') {
      console.warn(
        `Warning: Expected "${
          options.envVarName ?? paramName
        }" to be one of ${mapping
          .map((value) =>
            typeof value === 'string'
              ? `"${value}"`
              : value.map((v) => `"${v}"`).join(', '),
          )
          .join(', ')} - ignoring invalid value!!`,
      );
    }
  };
}
