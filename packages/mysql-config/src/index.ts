import cosmiconfig = require('cosmiconfig');
import MySqlConfig, {MySqlConfigSchema} from './MySqlConfig';

const explorer = cosmiconfig('mysql');
export async function getMySqlConfig(
  searchFrom?: string,
): Promise<MySqlConfig> {
  return parseResult(await explorer.search(searchFrom));
}
export function getMySqlConfigSync(searchFrom?: string): MySqlConfig {
  return parseResult(explorer.searchSync(searchFrom));
}

export function readMySqlConfigSync(filename: string): MySqlConfig {
  return parseResult(explorer.loadSync(filename));
}

function parseResult(result: cosmiconfig.CosmiconfigResult): MySqlConfig {
  return MySqlConfigSchema.parse(result ? result.config : {});
}

export default MySqlConfig;
export const DEFAULT_CONFIG = MySqlConfigSchema.parse({});
