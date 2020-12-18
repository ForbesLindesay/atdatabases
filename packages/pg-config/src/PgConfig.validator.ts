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
          type: 'number',
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
          default: 'postgres:10.6-alpine',
          description:
            'The docker image to use when testing\nusing @databases/pg-test',
          type: 'string',
        },
        migrationsScript: {
          anyOf: [
            {
              items: {
                type: 'string',
              },
              type: 'array',
            },
            {
              type: 'string',
            },
          ],
          description:
            'Optional script to run after the database\nhas been started but before running tests',
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
          type: 'number',
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
    TypesConfig: {
      defaultProperties: [],
      properties: {
        columnTypeOverrides: {
          additionalProperties: {
            type: 'string',
          },
          default: {},
          defaultProperties: [],
          description:
            'Override column types for some columns. The name can be either:\n\n- "table_name.column_name"\n- "schema_name.table_name.column_name"',
          type: 'object',
        },
        directory: {
          default: '__generated__',
          description:
            'The directory (relative to this config) to put the generated code in',
          type: 'string',
        },
        domainFileName: {
          default: '_custom_types.ts',
          description:
            'Where should generated types for domains be put (ignored for domainTypeMode="inline")',
          type: 'string',
        },
        domainTypeMode: {
          default: 'loose_brand',
          description:
            'What should be generated for custom types with constraints?',
          enum: ['alias', 'inline', 'loose_brand', 'strict_brand'],
          type: 'string',
        },
        domainTypeName: {
          default: '{{ TYPE_NAME | pascal-case }}',
          description:
            'What should custom types be called (ignored for domainTypeMode="inline")',
          type: 'string',
        },
        enumFileName: {
          default: '_enums.ts',
          description:
            'Where should generated types for enums be put (ignored for enumTypeMode="inline")',
          type: 'string',
        },
        enumTypeMode: {
          default: 'union_alias',
          description:
            'How should Postgres enums be represented in TypeScript?',
          enum: ['enum', 'inline', 'union_alias', 'union_alias_with_object'],
          type: 'string',
        },
        enumTypeName: {
          default: '{{ TYPE_NAME | pascal-case }}',
          description:
            'What should enums be called (ignored for enumTypeMode="inline")',
          type: 'string',
        },
        primaryKeyFileName: {
          default: '{{ TABLE_NAME }}.ts',
          description:
            'Where should generated types for primary keys be put (ignored for primaryKeyMode="inline")',
          type: 'string',
        },
        primaryKeyTypeMode: {
          default: 'inline_loose_brand',
          description: 'Do you want to use branded types for primary keys?',
          enum: [
            'inline_loose_brand',
            'inline_no_brand',
            'inline_strict_brand',
            'loose_brand',
            'strict_brand',
          ],
          type: 'string',
        },
        primaryKeyTypeName: {
          default:
            '{{ TABLE_NAME | pascal-case }}_{{ COLUMN_NAME | pascal-case }}',
          description:
            'What should types for primary keys be called (ignored for primaryKeyMode="inline_*")',
          type: 'string',
        },
        schemaFileName: {
          default: 'index.ts',
          description:
            'What filename do you want to use for the main generated "schema" type',
          type: 'string',
        },
        schemaTypeName: {
          default: 'DatabaseSchema',
          description: 'What should the main generated "schema" type be called',
          type: 'string',
        },
        serializeValueFileName: {
          default: 'index.ts',
          description:
            'What filename do you want to use for the generated "serializeValue" function',
          type: 'string',
        },
        serializeValueTypeName: {
          default: 'serializeValue',
          description:
            'What should the generated "serializeValue" function be called',
          type: 'string',
        },
        tableFileName: {
          default: '{{ TABLE_NAME }}.ts',
          description: 'What filename do you want to use for tables',
          type: 'string',
        },
        tableInsertParametersFileName: {
          default: '{{ TABLE_NAME }}.ts',
          description:
            'What filename do you want to use for tables insert parameters',
          type: 'string',
        },
        tableInsertParametersTypeName: {
          default: '{{ TABLE_NAME | pascal-case }}_InsertParameters',
          description:
            'What should TypeScript types for table insert parameters be called',
          type: 'string',
        },
        tableTypeName: {
          default: '{{ TABLE_NAME | pascal-case }}',
          description:
            'What should TypeScript types for table records be called',
          type: 'string',
        },
        typeOverrides: {
          additionalProperties: {
            type: 'string',
          },
          default: {},
          defaultProperties: [],
          description:
            'Override generated TypeScript types for some types. The name can be either:\n\n- key of @databases/pg-data-type-id (e.g. "json")\n- value of @databases/pg-data-type-id (e.g. 114)\n- "custom_type_name"\n- "schema_name.custom_type_name"',
          type: 'object',
        },
      },
      required: [
        'columnTypeOverrides',
        'directory',
        'domainFileName',
        'domainTypeMode',
        'domainTypeName',
        'enumFileName',
        'enumTypeMode',
        'enumTypeName',
        'primaryKeyFileName',
        'primaryKeyTypeMode',
        'primaryKeyTypeName',
        'schemaFileName',
        'schemaTypeName',
        'serializeValueFileName',
        'serializeValueTypeName',
        'tableFileName',
        'tableInsertParametersFileName',
        'tableInsertParametersTypeName',
        'tableTypeName',
        'typeOverrides',
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
    migrationsDirectory: {
      description:
        'The directory containing migrations (when using @databases/pg-migrations)',
      type: 'string',
    },
    test: {
      $ref: '#/definitions/TestConfig',
      default: {},
      description: 'Config for pg-test',
    },
    types: {
      $ref: '#/definitions/TypesConfig',
      default: {},
      description: 'Config for pg-schema-print-types',
    },
  },
  required: ['connectionStringEnvironmentVariable', 'test', 'types'],
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
