import {cosmiconfig, cosmiconfigSync} from 'cosmiconfig';
import MySqlConfig, {MySqlConfigSchema} from './MySqlConfig';

const asyncExplorer = cosmiconfig('mysql');
const syncExplorer = cosmiconfigSync('mysql');

export async function getMySqlConfig(
  searchFrom?: string,
): Promise<MySqlConfig> {
  return parseResult(await asyncExplorer.search(searchFrom));
}
export function getMySqlConfigSync(searchFrom?: string): MySqlConfig {
  return parseResult(syncExplorer.search(searchFrom));
}

export function readMySqlConfigSync(filename: string): MySqlConfig {
  return parseResult(syncExplorer.load(filename));
}

function parseResult(result: null | {config: unknown}): MySqlConfig {
  return MySqlConfigSchema.parse(result ? result.config : {});
}

export default MySqlConfig;
export const DEFAULT_CONFIG = MySqlConfigSchema.parse({});
