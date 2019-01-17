const handlers = [
  require('../../packages/pg-test/jest/globalTeardown.js'),
  require('../../packages/mysql-test/jest/globalTeardown.js'),
];
module.exports = () => Promise.all(handlers.map(fn => fn()));
