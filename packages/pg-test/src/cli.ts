#!/usr/bin/env node

import call from './cli-function';

call(process.argv.slice(2))
  .then(code => process.exit(code))
  .catch(ex => {
    console.error(ex);
    process.exit(1);
  });
