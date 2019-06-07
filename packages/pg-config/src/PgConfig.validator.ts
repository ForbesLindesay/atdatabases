import {inspect} from 'util';
import Ajv = require('ajv');
import PgConfig from './PgConfig';
export const ajv = new Ajv({
  allErrors: true,
  coerceTypes: false,
  format: 'fast',
  nullable: true,
  unicode: true,
  uniqueItems: true,
  useDefaults: true,
});

ajv.addMetaSchema(require('ajv/lib/refs/json-schema-draft-06.json'));

export {PgConfig};
export const PgConfigSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  defaultProperties: [],
  definitions: {
    TestConfig: {
      defaultProperties: [],
      properties: {
        connectTimeoutSeconds: {
          default: 20,
          description:
            'The timeout in seconds when waiting for the test docker image to start',
          minimum: 0,
          type: 'integer',
        },
        containerName: {
          default: 'pg-test',
          description:
            'The default name to give the docker\ncontainers run by @database/pg-test',
          type: 'string',
        },
        debug: {
          default: false,
          description:
            'Whether to output logs to stdout/stderr from docker\nscripts.',
          type: 'boolean',
        },
        image: {
          default: 'circleci/postgres:10.6-alpine-ram',
          description:
            'The docker image to use when testing\nusing @databases/pg-test',
          type: 'string',
        },
        migrationsScript: {
          description:
            'Optional script to run after the database\nhas been started but before running tests',
          items: {
            type: 'string',
          },
          type: 'array',
        },
        pgDb: {
          default: 'test-db',
          description: 'The db to create in the test docker container',
          type: 'string',
        },
        pgUser: {
          default: 'test-user',
          description:
            'The user name to configure in the test docker container',
          type: 'string',
        },
        port: {
          description:
            'The port to run postgres on when running docker\nfor tests. Defaults to 5432 or the first available\nport after that.',
          maximum: 65535,
          minimum: 0,
          type: 'integer',
        },
      },
      required: [
        'connectTimeoutSeconds',
        'containerName',
        'debug',
        'image',
        'pgDb',
        'pgUser',
      ],
      type: 'object',
    },
  },
  properties: {
    connectionStringEnvironmentVariable: {
      default: 'DATABASE_URL',
      description:
        'The environment variable containing the\nconnection string to the postgres database',
      type: 'string',
    },
    test: {
      $ref: '#/definitions/TestConfig',
      default: {},
      description: 'Config for pg-test',
    },
  },
  required: ['connectionStringEnvironmentVariable', 'test'],
  type: 'object',
};
export type ValidateFunction<T> = ((data: unknown) => data is T) &
  Pick<Ajv.ValidateFunction, 'errors'>;
const rawValidatePgConfig = ajv.compile(PgConfigSchema) as ValidateFunction<
  PgConfig
>;
export default function validate(value: unknown): PgConfig {
  if (rawValidatePgConfig(value)) {
    return value;
  } else {
    throw new Error(
      ajv.errorsText(rawValidatePgConfig.errors, {dataVar: 'PgConfig'}) +
        '\n\n' +
        inspect(value),
    );
  }
}
