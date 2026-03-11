/**
 * This file handles 33.1.1.1 from https://www.postgresql.org/docs/13/libpq-connect.html
 */

import Configuration, {
  ConfigurationBuilder,
  ConfigurationOptions,
} from './Configuration';

export type {Configuration, ConfigurationOptions};

export function isKeywordValueConnectionString(str: string): boolean {
  return /^\s*[a-z_]+\s*\=/.test(str);
}
export default function parseKeywordValueConnectionString(
  str: string,
  options: ConfigurationOptions,
): Configuration {
  const config = new ConfigurationBuilder(options);
  let isKey = true;
  let key = '';
  let value = '';
  let quoted = false;
  let escaped = false;
  for (const char of str) {
    if (isKey) {
      if (char === '=') {
        isKey = false;
      } else {
        key += char;
      }
    } else {
      if (escaped) {
        escaped = false;
        value += char;
      } else if (quoted) {
        if (char === `'`) {
          quoted = false;
          config.set(key.trim(), value);
          isKey = true;
          key = '';
          value = '';
        } else if (char === '\\') {
          escaped = true;
        } else {
          value += char;
        }
      } else if (char === ' ') {
        if (value) {
          config.set(key.trim(), value);
          isKey = true;
          key = '';
          value = '';
        }
      } else if (char === `'`) {
        quoted = true;
      } else {
        value += char;
      }
    }
  }
  if (key.trim() && isKey) {
    throw new Error(`Missing value for ${key}`);
  }
  if (key.trim() || value) {
    config.set(key.trim(), value);
  }
  return config.getConfig();
}
