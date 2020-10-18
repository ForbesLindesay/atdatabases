import {resolve} from 'path';
import {parse, startChain, param} from 'parameter-reducers';
import isInteractive = require('is-interactive');
import * as interrogator from 'interrogator';
import chalk from 'chalk';
import getSchema, {connect} from '@databases/pg-schema-introspect';
import {readPgConfigSync, getPgConfigSync} from '@databases/pg-config';
import {writeSchema} from '@databases/pg-schema-print-types';

const parameterParser = startChain()
  .addParam(param.string(['-c', '--database'], 'database'))
  .addParam(param.string(['-d', '--directory'], 'directory'))
  .addParam(param.string(['--config'], 'configFilename'));
export default async function run(
  cwd: string,
  args: string[],
): Promise<number> {
  const params = parse(parameterParser, args).extract();
  const {
    connectionStringEnvironmentVariable,
    types: {directory, ...types},
  } = params.configFilename
    ? readPgConfigSync(params.configFilename)
    : getPgConfigSync();
  let database =
    params.database ?? process.env[connectionStringEnvironmentVariable];
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
      ` - The ${chalk.cyan('--database')} paramter when calling pg-migrations`,
    );
    console.error('');
    if (isInteractive()) {
      database = await interrogator.input('Please enter a connection string:');
    }
  }
  if (!database) {
    return 1;
  }
  const connection = connect(database, {poolSize: 1});
  let schema;
  try {
    schema = await getSchema(connection);
  } finally {
    await connection.dispose().catch(() => {
      // ignore the error if it's just disposing the database connection
    });
  }
  await writeSchema(
    schema,
    resolve(process.cwd(), params.directory ?? directory),
    types,
  );
  return 0;
}
