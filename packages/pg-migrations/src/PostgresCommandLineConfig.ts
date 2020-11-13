import connect from '@databases/pg';
import {getPgConfigSync} from '@databases/pg-config';
import isInteractive = require('is-interactive');
import * as interrogator from 'interrogator';
import chalk = require('chalk');
import {
  CommandLineInterfaceConfig,
  parameters,
} from '@databases/migrations-base';
import PostgresDatabaseEngine, {
  Migration,
  MigrationsConfig,
} from './PostgresDatabaseEngine';
import assertIsDirectory from './assertIsDirectory';

const {
  connectionStringEnvironmentVariable,
  migrationsDirectory,
} = getPgConfigSync();

export interface Parameters extends MigrationsConfig {
  database: string;
  directory: string;
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
      description: `A connection string for the database you want to connect to (can also be supplied as the environment variable ${connectionStringEnvironmentVariable}).`,
    },
    {
      short: '-D',
      long: '--directory',
      description:
        'The directory containing migrations (can also be supplied via the "migrationsDirectory" config option).',
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
    .addParam(parameters.param.string(['-D', '--directory'], 'directory'))
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
    directory = migrationsDirectory,
  }) => {
    let migrationsDirectory = directory;
    if (!migrationsDirectory) {
      console.error(
        'You must supply a directory path for your migrations. You can supply it as either:',
      );
      console.error('');
      console.error(
        ` - The ${chalk.cyan(
          'migrationsDirectory',
        )} config value using @databases/pg-config`,
      );
      console.error(
        ` - The ${chalk.cyan(
          '--directory',
        )} paramter when calling @databases/pg-migrations`,
      );
      console.error('');
      if (isInteractive()) {
        migrationsDirectory = await interrogator.input(
          'Please enter a directory:',
        );
      }
    }
    if (!migrationsDirectory) {
      process.exit(1);
    }
    migrationsDirectory = assertIsDirectory(migrationsDirectory, 'exit');

    let connection =
      database &&
      connect({connectionString: database, poolSize: 1, bigIntMode: 'bigint'});
    if (!connection) {
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
        connection =
          connectionString &&
          connect({connectionString, poolSize: 1, bigIntMode: 'bigint'});
      }
    }
    if (!connection) {
      process.exit(1);
    }
    return new PostgresDatabaseEngine(connection, {
      versionTableName,
      appliedMigrationsTableName,
      migrationsDirectory,
    });
  },
};
export default PostgresCommandLineConfig;
