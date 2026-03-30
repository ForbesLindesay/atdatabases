import {getCommandLineInterface} from '@databases/migrations-base';
import PostgresCommandLineConfig from './PostgresCommandLineConfig';

const cli: (argv: readonly string[]) => void = getCommandLineInterface(
  PostgresCommandLineConfig,
);
export default cli;
