#! /usr/bin/env node

import {cli} from '.';

cli(process.argv.slice(2))
  .then((status) => {
    process.exit(status);
  })
  .catch((ex) => {
    console.error(ex?.stack || ex?.message || ex);
    process.exit(1);
  });
