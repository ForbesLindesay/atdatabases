import {inspect} from 'util';
import Ajv = require('ajv');
import MySqlConfig from './MySqlConfig';
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

export {MySqlConfig};
export const MySqlConfigSchema = {
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
          default: 'mysql-test',
          description:
            'The default name to give the docker\ncontainers run by @database/mysql-test',
          type: 'string',
        },
        debug: {
          default: false,
          description:
            'Whether to output logs to stdout/stderr from docker\nscripts.',
          type: 'boolean',
        },
        image: {
          default: 'mysql:5.7.24',
          description:
            "The docker image to use when testing\nusing @databases/mysql-test. When I\ntried using the ream image it didn't\nwork very well.\n\nSee https://github.com/mysqljs/mysql/pull/1962\nfor issues supporting mysql 8",
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
        mySqlDb: {
          default: 'test-db',
          description: 'The db to create in the test docker container',
          type: 'string',
        },
        mySqlPassword: {
          default: 'password',
          description: 'The password to configure in the test docker container',
          type: 'string',
        },
        mySqlUser: {
          default: 'test-user',
          description:
            'The user name to configure in the test docker container',
          type: 'string',
        },
        port: {
          description:
            'The port to run mysql on when running docker\nfor tests. Defaults to 3306 or the first available\nport after that.',
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
        'mySqlDb',
        'mySqlPassword',
        'mySqlUser',
      ],
      type: 'object',
    },
  },
  properties: {
    connectionStringEnvironmentVariable: {
      default: 'DATABASE_URL',
      description:
        'The environment variable containing the\nconnection string to the mysql database',
      type: 'string',
    },
    test: {
      $ref: '#/definitions/TestConfig',
      default: {},
      description: 'Config for mysql-test',
    },
  },
  required: ['connectionStringEnvironmentVariable', 'test'],
  type: 'object',
};
export type ValidateFunction<T> = ((data: unknown) => data is T) &
  Pick<Ajv.ValidateFunction, 'errors'>;
const rawValidateMySqlConfig = ajv.compile(
  MySqlConfigSchema,
) as ValidateFunction<MySqlConfig>;
export default function validate(value: unknown): MySqlConfig {
  if (rawValidateMySqlConfig(value)) {
    return value;
  } else {
    throw new Error(
      ajv.errorsText(rawValidateMySqlConfig.errors, {dataVar: 'MySqlConfig'}) +
        '\n\n' +
        inspect(value),
    );
  }
}
