import cosmiconfig = require('cosmiconfig');
import validateMySqlConfig, {MySqlConfig} from './MySqlConfig.validator';

const explorer = cosmiconfig('mysql');
export async function getMySqlConfig(searchFrom?: string) {
  return parseResult(await explorer.search(searchFrom));
}
export function getMySqlConfigSync(searchFrom?: string) {
  return parseResult(explorer.searchSync(searchFrom));
}

export function _testReadMySqlConfigSync(filename: string) {
  return parseResult(explorer.loadSync(filename));
}

function parseResult(result: cosmiconfig.CosmiconfigResult) {
  return validateMySqlConfig(result ? result.config : {});
}

export default MySqlConfig;
