import {
  parse,
  startChain,
  valid,
  invalid,
  ParameterReducer,
  param,
} from 'parameter-reducers';
import chalk from 'chalk';
import runCommand, {Command} from './runCommand';
import applyMigrations from './commands/applyMigrations';
import ignoreError from './commands/ignoreError';
import MigrationError from './types/MigrationError';
import {MigrationCommandParameters} from './MigrationContext';
import handleError from './handleErrorInteractive';
import markMigrationAsApplied from './commands/markMigrationAsApplied';
import markMigrationAsUnapplied from './commands/markMigrationAsUnapplied';
import restoreMigrationFromDatabase from './commands/restoreMigrationFromDatabase';
import printError from './methods/printError';
import DatabaseEngine from './types/DatabaseEngine';

const GLOBAL_PARAMETERS: {
  short?: string;
  long: string;
  description: string;
}[] = [
  {
    short: '-d',
    long: '--dry-run',
    description: 'Do actually modify the database or file system.',
  },
];
export interface CommandLineInterfaceConfig<TMigration, TParameters> {
  cliName: string;
  parameterDocumentation: {short?: string; long: string; description: string}[];
  parameterParser: ParameterReducer<TParameters>;
  getEngine: (
    parameters: Partial<TParameters>,
  ) => Promise<DatabaseEngine<TMigration>>;
}

function printParameters(
  params: {short?: string; long: string; description: string}[],
) {
  const maxShortLength = Math.max(
    0,
    ...params.map((s) => (s.short ? s.short.length : 0)),
  );
  const maxLongLength = Math.max(0, ...params.map((s) => s.long.length));
  for (const param of params) {
    if (maxShortLength) {
      console.info(
        `${(param.short || '').padEnd(maxShortLength, ' ')} ${param.long.padEnd(
          maxLongLength,
          ' ',
        )} ${param.description}`,
      );
    } else {
      console.info(
        `${param.long.padEnd(maxLongLength, ' ')} ${param.description}`,
      );
    }
  }
}

function prepareCommand(
  description: string,
  printHelp: <TMigration, TParameters>(
    config: CommandLineInterfaceConfig<TMigration, TParameters>,
  ) => void,
  parameterParser: ParameterReducer<MigrationCommandParameters>,
  command: Command<void, MigrationError>,
) {
  return {
    description,
    printHelp,
    run: async <TMigration, TParameters>(
      config: CommandLineInterfaceConfig<TMigration, TParameters>,
      args: string[],
    ) => {
      const parsedArgs = parse(
        startChain()
          .addParam(parameterParser)
          .addParam(config.parameterParser)
          .addParam(param.flag(['-d', '--dry-run'], 'dryRun')),
        args,
      ).extract();
      const engine = await config.getEngine(parsedArgs);
      try {
        let appliedMigrationsCount = 0;
        const runResult = await runCommand(engine, command, parsedArgs, {
          dryRun: parsedArgs.dryRun || false,
          handleError,
          async beforeOperation(op) {
            if (op.kind === 'apply') {
              console.info(
                `${chalk.cyan(`Applying`)} ${op.value.name}${
                  parsedArgs.dryRun ? chalk.cyan(` (dry run only)`) : ``
                }`,
              );
              // TODO: interactive mode could stop for confirmation?
            }
          },
          async afterOperation(op) {
            if (op.kind === 'apply') {
              appliedMigrationsCount++;
              console.info(
                `${chalk.green(`Applied`)} ${op.value.name}${
                  parsedArgs.dryRun
                    ? chalk.cyan(` (dry run only, not actually applied)`)
                    : ``
                }`,
              );
            }
          },
        });
        if (!runResult.ok) {
          printError(runResult.reason, engine);
          if (
            runResult.reason.code !== 'database_uses_older_version' ||
            !parsedArgs.dryRun
          ) {
            process.exitCode = 1;
          } else if (parsedArgs.dryRun) {
            console.info(
              'To update your database, run again without --dry-run',
            );
          }
        } else if (parsedArgs.dryRun) {
          if (appliedMigrationsCount) {
            console.info(
              `To apply ${appliedMigrationsCount} migrations, run again without --dry-run`,
            );
          } else {
            console.info(`No migrations required`);
          }
        } else {
          if (appliedMigrationsCount) {
            console.info(`${appliedMigrationsCount} migrations applied`);
          } else {
            console.info(`No migrations required`);
          }
        }
      } finally {
        try {
          await engine.dispose();
        } catch (ex) {
          // ignore errors closing db connections
        }
      }
    },
  };
}

export const commands = {
  apply: prepareCommand(
    'Apply any pending migration',
    (config) => {
      console.info(chalk.cyan('Apply Migrations'));
      console.info('');
      console.info(`Usage: ${config.cliName} apply [options]`);
      console.info('');
      console.info('Parameters:');
      printParameters([
        ...config.parameterDocumentation,
        {
          short: '-e',
          long: '--ignore-error',
          description:
            'Error code to ignore (can use multiple times to ignore multiple errors)',
        },
        ...GLOBAL_PARAMETERS,
      ]);
    },
    startChain().addParam(
      param.parsedStringList(
        ['-e', '--ignore-error'],
        'ignored_errors',
        (value, key) => {
          switch (value) {
            case 'migration_file_missing':
            case 'migration_file_edited':
            case 'migration_order_change':
              return valid(value);
            default:
              return invalid(
                `Expected ${key} to have a parameter that is one of: 'migration_file_missing' | 'migration_file_edited' | 'migration_order_change'`,
              );
              break;
          }
        },
      ),
    ),
    applyMigrations(),
  ),
  'ignore-error': prepareCommand(
    'Permanently ignore an error for a migration',
    (config) => {
      console.info(chalk.cyan('Permanently ignore an error for a migration'));
      console.info('');
      console.info(
        `Usage: ${config.cliName} ignore-error -e ERROR_CODE -m MIGRATION_INDEX`,
      );
      console.info('');
      console.info('Parameters:');
      printParameters([
        ...config.parameterDocumentation,
        {
          short: '-e',
          long: '--error',
          description:
            'Error code to ignore (one of "migration_file_missing" | "migration_file_edited" | "migration_order_change")',
        },
        {
          short: '-m',
          long: '--migration',
          description: 'The index of the migration to ignore an error for',
        },
        ...GLOBAL_PARAMETERS,
      ]);
    },
    startChain()
      .addParam(
        param.parsedString(['-e', '--error'], 'error_type', (value, key) => {
          switch (value) {
            case 'migration_file_missing':
            case 'migration_file_edited':
            case 'migration_order_change':
              return valid(value);
            default:
              return invalid(
                `Expected ${key} to have a parameter that is one of: 'migration_file_missing' | 'migration_file_edited' | 'migration_order_change'`,
              );
              break;
          }
        }),
      )
      .addParam(param.integer(['-m', '--migration'], 'applied_migration')),
    ignoreError(),
  ),
  'mark-applied': prepareCommand(
    'Mark migration as applied (without applying it)',
    (config) => {
      console.info(
        chalk.cyan('Mark migration as applied (without applying it)'),
      );
      console.info('');
      console.info(`Usage: ${config.cliName} mark-applied -m MIGRATION_INDEX`);
      console.info('');
      console.info('Parameters:');
      printParameters([
        ...config.parameterDocumentation,
        {
          short: '-m',
          long: '--migration',
          description: 'The index of the migration to mark as applied',
        },
        ...GLOBAL_PARAMETERS,
      ]);
    },
    startChain().addParam(
      param.integer(['-m', '--migration'], 'migration_file'),
    ),
    markMigrationAsApplied(),
  ),
  'mark-unapplied': prepareCommand(
    'Mark migration as unapplied (without reverting it)',
    (config) => {
      console.info(
        chalk.cyan('Mark migration as unapplied (without reverting it)'),
      );
      console.info('');
      console.info(
        `Usage: ${config.cliName} mark-unapplied -m MIGRATION_INDEX`,
      );
      console.info('');
      console.info('Parameters:');
      printParameters([
        ...config.parameterDocumentation,
        {
          short: '-m',
          long: '--migration',
          description: 'The index of the migration to mark as unapplied',
        },
        ...GLOBAL_PARAMETERS,
      ]);
    },
    startChain().addParam(
      param.integer(['-m', '--migration'], 'applied_migration'),
    ),
    markMigrationAsUnapplied(),
  ),
  'restore-from-db': prepareCommand(
    'Restore a previously applied migration from the database',
    (config) => {
      console.info(
        chalk.cyan('Restore a previously applied migration from the database'),
      );
      console.info('');
      console.info(
        `Usage: ${config.cliName} restore-from-db -m MIGRATION_INDEX`,
      );
      console.info('');
      console.info('Parameters:');
      printParameters([
        ...config.parameterDocumentation,
        {
          short: '-m',
          long: '--migration',
          description: 'The index of the migration to restore',
        },
        ...GLOBAL_PARAMETERS,
      ]);
    },
    startChain().addParam(
      param.integer(['-m', '--migration'], 'applied_migration'),
    ),
    restoreMigrationFromDatabase(),
  ),
};

const commandNames = [
  'apply',
  'ignore-error',
  'mark-applied',
  'mark-unapplied',
  'restore-from-db',
] as const;
function printAllHelp<TMigration, TParameters>(
  config: CommandLineInterfaceConfig<TMigration, TParameters>,
) {
  console.info('Available commands:');
  console.info('');

  const maxLength = Math.max(
    0,
    ...commandNames.map((key) => `${config.cliName} ${key}`.length),
  );
  for (const key of commandNames) {
    console.info(
      `${config.cliName} ${key}`.padEnd(maxLength, ' ') +
        ` - ${commands[key].description}`,
    );
  }
  console.info('');
  console.info(`For more information on a command, run:`);
  console.info(``);
  console.info(`${config.cliName} help <COMMAND_NAME>`);
}

export default function getCommandLineInterface<TMigration, TParameters>(
  config: CommandLineInterfaceConfig<TMigration, TParameters>,
) {
  return (argv: readonly string[]) => {
    const [commandName, ...params] = argv;
    const commandMethod =
      commandName in commands
        ? commands[commandName as keyof typeof commands]
        : null;
    if (commandMethod) {
      if (params.includes('--help') || params.includes('-h')) {
        commandMethod.printHelp(config);
        process.exit(0);
      } else {
        commandMethod.run(config, params).catch((ex) => {
          console.error(ex?.stack || ex?.message || ex);
          process.exit(1);
        });
      }
    } else if (commandName === 'help') {
      const subCommand = params[0];
      const commandMethod =
        subCommand in commands
          ? commands[subCommand as keyof typeof commands]
          : null;
      if (commandMethod) {
        commandMethod.printHelp(config);
        process.exit(0);
      } else {
        if (subCommand) {
          console.error(`Unrecognized command: ${subCommand}`);
        }
        printAllHelp(config);
        process.exit(params.length === 0 ? 0 : 1);
      }
    } else {
      if (commandName) {
        console.error(`Unrecognized command: ${commandName}`);
      }
      printAllHelp(config);
      process.exit(1);
    }
  };
}
