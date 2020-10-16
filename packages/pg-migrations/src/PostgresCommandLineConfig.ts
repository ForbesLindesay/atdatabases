import connect from '@databases/pg';
import {getPgConfigSync} from '@databases/pg-config';
import isInteractive = require('is-interactive');
import * as interrogator from 'interrogator';
import {
  CommandLineInterfaceConfig,
  parameters,
} from '@databases/migrations-base';
import {Migration, MigrationsConfig} from './PostgresDatabaseEngine';
import {PostgresDatabaseEngine} from '.';
import chalk from 'chalk';

const {connectionStringEnvironmentVariable} = getPgConfigSync();

export interface Parameters extends MigrationsConfig {
  database: string;
}
const PostgresCommandLineConfig: CommandLineInterfaceConfig<
  Migration,
  Parameters
> = {
  cliName: 'pg-migrations',
  parameterDocumentation: [
    {
      short: '-c',
      long: '--database',
      description:
        'A connection string for the database you want to connect to.',
    },
    {
      long: '--version-table',
      description:
        'A table to store the version of @databases used. Defaults to "atdatabases_migrations_version".',
    },
    {
      long: '--migrations-table',
      description:
        'A table to store the applied migrations. Defaults to "atdatabases_migrations_applied".',
    },
  ],
  parameterParser: parameters
    .startChain()
    .addParam(parameters.param.string(['-c', '--database'], 'database'))
    .addParam(parameters.param.string(['--version-table'], 'versionTableName'))
    .addParam(
      parameters.param.string(
        ['--migrations-table'],
        'appliedMigrationsTableName',
      ),
    ),
  getEngine: async ({
    database = process.env[connectionStringEnvironmentVariable],
    versionTableName = 'atdatabases_migrations_version',
    appliedMigrationsTableName = 'atdatabases_migrations_applied',
  }) => {
    if (!database) {
      console.error(
        'You must supply a connection string for the database. You can supply it as either:',
      );
      console.error('');
      console.error(
        ` - The environment variable ${chalk.cyan(
          connectionStringEnvironmentVariable,
        )}`,
      );
      console.error(
        ` - The ${chalk.cyan(
          '--database',
        )} paramter when calling pg-migrations`,
      );
      console.error('');
      if (isInteractive()) {
        const connectionString = await interrogator.input(
          'Please enter a connection string:',
        );
        return new PostgresDatabaseEngine(
          connect(connectionString, {poolSize: 1}),
          {
            versionTableName,
            appliedMigrationsTableName,
          },
        );
      }
      process.exit(1);
    }
    return new PostgresDatabaseEngine(connect(database, {poolSize: 1}), {
      versionTableName,
      appliedMigrationsTableName,
    });
  },
};
export default PostgresCommandLineConfig;
