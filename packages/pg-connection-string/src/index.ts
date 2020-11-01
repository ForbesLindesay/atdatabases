import Configuration, {
  ConfigurationOptions,
  ConfigurationBuilder,
} from './Configuration';
import parseConnectionURI, {isConnectionURI} from './parseConnectionURI';
import parseKeywordValueConnectionString, {
  isKeywordValueConnectionString,
} from './parseKeywordValueConnectionString';

export default function parseConnectionString(
  str: string | undefined,
  {
    invalidOptionMode = 'error',
    unrecognisedOptionMode = 'warn',
    env = process.env,
  }: Partial<ConfigurationOptions> = {},
): Configuration {
  if (str === undefined) {
    return new ConfigurationBuilder({
      invalidOptionMode,
      unrecognisedOptionMode,
      env,
    }).getConfig();
  }
  if (isConnectionURI(str)) {
    return parseConnectionURI(str, {
      invalidOptionMode,
      unrecognisedOptionMode,
      env,
    });
  }
  if (isKeywordValueConnectionString(str)) {
    return parseKeywordValueConnectionString(str, {
      invalidOptionMode,
      unrecognisedOptionMode,
      env,
    });
  }
  throw new Error(
    `Expected either a Connection URI, starting with "postgresql://" or "postgres://" or a Keyword/Value Connection String. See https://www.postgresql.org/docs/13/libpq-connect.html for examples.`,
  );
}
