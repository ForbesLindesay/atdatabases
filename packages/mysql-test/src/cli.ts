#! /usr/bin/env nod

import getDatabase, {killDatabase} from '.';

// tslint:disable-next-line:no-unused-expression
require('yargs')
  .command(
    'start',
    'start the database',
    (yargs: any) => {
      // TODO: take options as CLI parameters
    },
    async (argv: any) => {
      try {
        const {databaseURL} = await getDatabase({detached: true});
        console.info(databaseURL);
      } catch (ex) {
        console.error(ex.stack || ex);
        process.exit(1);
      }
    },
  )
  .command(
    'kill',
    'kill the database',
    (yargs: any) => {
      // TODO: take options as CLI parameters
    },
    async (argv: any) => {
      try {
        await killDatabase();
      } catch (ex) {
        console.error(ex.stack || ex);
        process.exit(1);
      }
    },
  )
  .strict()
  .demandCommand()
  .help().argv;
