const {spawnSync} = require('child_process');

const VERSIONS = [
  '10.14-alpine',
  '11.9-alpine',
  '12.4-alpine',
  '13.0-alpine',
  '14.9-alpine',
  '15.8-alpine',
  '16.4-alpine',
];

for (const version of VERSIONS.reverse()) {
  console.log('version =', version);
  const result = spawnSync('yarn', ['run', 'test:pg', '-u'], {
    env: {...process.env, PG_TEST_IMAGE: `postgres:${version}`},
    stdio: 'inherit',
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status);
  }
}
