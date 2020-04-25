const {sync: spawnSync} = require('cross-spawn');

const onlyChanged = process.argv.includes('--only-changed');
const scriptArgs = onlyChanged ? [] : ['--force'];
console.log(
  'wsrun ' +
    ['--stages', 'node', '../../scripts/build', ...scriptArgs]
      .map(v => JSON.stringify(v))
      .join(' '),
);
const result = spawnSync(
  'wsrun',
  ['--stages', 'node', '../../scripts/build', ...scriptArgs],
  {
    stdio: 'inherit',
  },
);

if (result.status !== 0) {
  process.exit(1);
}
