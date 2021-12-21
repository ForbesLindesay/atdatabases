#! /usr/bin/env node

import run from '.';

run(process.cwd(), process.argv.slice(2))
  .then((status) => {
    process.exit(status);
  })
  .catch((ex) => {
    console.error(ex?.stack || ex?.message || ex);
    process.exit(1);
  });
