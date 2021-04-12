import {killers} from './globalSetup';

export default async function teardown() {
  await Promise.all(killers.map(async (kill) => await kill()));
}

module.exports = teardown;
module.exports.default = teardown;
