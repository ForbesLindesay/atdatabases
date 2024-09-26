/**
 * This file handles 33.1.1.2 from https://www.postgresql.org/docs/13/libpq-connect.html
 */

import {ConfigurationBuilder, ConfigurationOptions} from './Configuration';

export function isConnectionURI(str: string) {
  return str.startsWith('postgresql://') || str.startsWith('postgres://');
}

// The connection URI needs to be encoded with percent-encoding if it includes symbols with special meaning in any of its parts
const symbolsWithSpecialMeaning = new Set([':', '/', '@', ',', '?', '=', '&']);

// postgresql://[user[:password]@][netloc][:port][,...][/dbname][?param1=value1&...]
export default function parseConnectionURI(
  originalString: string,
  options: ConfigurationOptions,
) {
  const config = new ConfigurationBuilder(options);
  let str = originalString.startsWith('postgresql://')
    ? originalString.substr('postgresql://'.length)
    : originalString.startsWith('postgres://')
      ? originalString.substr('postgres://'.length)
      : fail(
          `Expected the connection string to start with "postgresql://" or "postgres://"`,
        );

  // [user[:password]@]
  str = parseAuth(config, str);

  // [netloc][:port][,...]
  let afterParsingHost = parsePort(config, parseHost(config, str));
  while (str !== afterParsingHost) {
    str = afterParsingHost;
    if (str[0] === ',') {
      str = str.substr(1);
      // parsing multiple hosts
      afterParsingHost = parsePort(config, parseHost(config, str));
    }
  }

  // [/dbname]
  str = parseDbName(config, str);

  // [?param1=value1&...]
  str = parseQueryString(config, str);

  if (str) {
    throw new Error(`Unexpected character in connection string "${str[0]}"`);
  }

  return config.getConfig();
}

// [user[:password]@]
function parseAuth(config: ConfigurationBuilder, str: string) {
  if (!str) return str;
  let user = '';
  let pass = '';
  let inPassword = false;
  for (const char of str) {
    if (char === '@') {
      config.set('user', decodeURIComponent(user));
      if (inPassword) config.set('password', decodeURIComponent(pass));
      return str.substr(`${user}${inPassword ? `:${pass}` : ''}@`.length);
    }
    if (!inPassword && char === ':') {
      inPassword = true;
    } else if (symbolsWithSpecialMeaning.has(char)) {
      return str;
    } else if (inPassword) {
      pass += char;
    } else {
      user += char;
    }
  }
  return str;
}

// [netloc]
function parseHost(config: ConfigurationBuilder, str: string) {
  if (!str) return str;
  let netloc = '';
  for (const char of str) {
    if (symbolsWithSpecialMeaning.has(char)) {
      break;
    } else {
      netloc += char;
    }
  }
  if (netloc) {
    config.set('host', decodeURIComponent(netloc));
  }
  return str.substr(netloc.length);
}

// [:port]
function parsePort(config: ConfigurationBuilder, str: string) {
  if (!str) return str;
  let start = true;
  let port = '';
  for (const char of str) {
    if (start) {
      start = false;
      if (char !== ':') {
        return str;
      }
    } else if (symbolsWithSpecialMeaning.has(char)) {
      break;
    } else {
      port += char;
    }
  }
  config.set('port', decodeURIComponent(port));
  return str.substr(port.length + 1);
}

// [/dbname]
function parseDbName(config: ConfigurationBuilder, str: string) {
  if (!str) return str;
  let start = true;
  let dbname = '';
  for (const char of str) {
    if (start) {
      start = false;
      if (char !== '/') {
        return str;
      }
    } else if (symbolsWithSpecialMeaning.has(char)) {
      break;
    } else {
      dbname += char;
    }
  }
  config.set('dbname', decodeURIComponent(dbname));
  return str.substr(dbname.length + 1);
}

// [?param1=value1&...]
function parseQueryString(config: ConfigurationBuilder, str: string) {
  if (!str) return str;
  let start = true;
  let inValue = false;
  let key = '';
  let value = '';
  for (const char of str) {
    if (start) {
      start = false;
      if (char !== '?') {
        return str;
      }
    } else if (inValue && char === '&') {
      inValue = false;
      config.set(decodeURIComponent(key), decodeURIComponent(value));
      key = '';
      value = '';
    } else if (!inValue && char === '=') {
      inValue = true;
    } else if (symbolsWithSpecialMeaning.has(char)) {
      throw new Error(
        `Unexpected character "${char}". All special chracters should be % encoded via encodeURIComponent`,
      );
    } else {
      if (inValue) {
        value += char;
      } else {
        key += char;
      }
    }
  }
  if (inValue) {
    config.set(decodeURIComponent(key), decodeURIComponent(value));
  } else if (key) {
    throw new Error(`Missing value for the key: "${key}"`);
  }
  return '';
}

function fail(reason: string): never {
  throw new Error(reason);
}
