const handlers = [
  require('../../packages/pg-test/jest/globalSetup.js'),
  require('../../packages/mysql-test/jest/globalSetup.js'),
];
module.exports = config => Promise.all(handlers.map(fn => fn(config)));
