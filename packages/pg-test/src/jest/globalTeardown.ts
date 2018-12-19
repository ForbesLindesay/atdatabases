// @public

import {killers} from './globalSetup';

module.exports = async () => {
  await Promise.all(killers.map(kill => kill()));
};
