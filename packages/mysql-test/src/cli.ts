import * as commands from './commands';

export default async function cli(allArgs: string[]): Promise<number> {
  const command = allArgs[0];
  const args = allArgs.slice(1);
  const hasHelpFlag = args.includes('--help') || args.includes('-h');

  switch (command) {
    case 'start':
      if (hasHelpFlag) {
        return commands.help('start');
      } else {
        return commands.start(args);
      }
    case 'run':
      if (hasHelpFlag) {
        return commands.help('run');
      } else {
        return commands.run(args);
      }
    case 'stop':
      if (hasHelpFlag) {
        return commands.help('stop');
      } else {
        return commands.stop(args);
      }
    case 'help':
      return commands.help(args[0]);
    default:
      commands.help();
      if (hasHelpFlag) {
        return 0;
      } else {
        console.error(
          `Unexpected command ${command}, expected one of "start" or "help"`,
        );
        return 1;
      }
  }
}
