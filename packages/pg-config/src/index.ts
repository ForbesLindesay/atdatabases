import cosmiconfig = require('cosmiconfig');
import validatePgConfig, {PgConfig} from './PgConfig.validator';

const explorer = cosmiconfig('pg');
export async function getPgConfig(searchFrom?: string) {
  return parseResult(await explorer.search(searchFrom));
}
export function getPgConfigSync(searchFrom?: string) {
  return parseResult(explorer.searchSync(searchFrom));
}

export function _testReadPgConfigSync(filename: string) {
  return parseResult(explorer.loadSync(filename));
}

function parseResult(result: cosmiconfig.CosmiconfigResult) {
  return validatePgConfig(result ? result.config : {});
}

export const DEFAULT_CONFIG = validatePgConfig({});
export default PgConfig;
