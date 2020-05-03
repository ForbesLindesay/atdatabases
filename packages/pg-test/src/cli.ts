#! /usr/bin/env node

import * as commands from './commands';
const command = process.argv[2];
const args = process.argv.slice(3);

const hasHelpFlag = args.includes('--help') || args.includes('-h');
if (hasHelpFlag) {
  commands.help();
  process.exit(0);
}

switch (command) {
  case 'start':
    if (hasHelpFlag) {
      commands.help('start');
    } else {
      handle(commands.start(args));
    }
    break;
  case 'run':
    if (hasHelpFlag) {
      commands.help('run');
    } else {
      handle(commands.run(args));
    }
    break;
  case 'stop':
    if (hasHelpFlag) {
      commands.help('stop');
    } else {
      handle(commands.stop(args));
    }
    break;
  case 'help':
    commands.help(args[0]);
    break;
  default:
    commands.help();
    if (!hasHelpFlag) {
      console.error(
        `Unexpected command ${command}, expected one of "start" or "help"`,
      );
      process.exit(1);
    }
    break;
}

function handle(v: Promise<number>) {
  if (!v) {
    process.exit(0);
  }
  v.then(
    (value) => {
      process.exit(value);
    },
    (ex) => {
      console.error(ex.stack || ex);
      process.exit(1);
    },
  );
}
