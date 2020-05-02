#!/usr/bin/env node

import createDb from './';

createDb().catch((ex) => {
  console.error(ex);
  process.exit(1);
});
