import cosmiconfig = require('cosmiconfig');
import PgConfig, {PgConfigSchema} from './PgConfig';

const explorer = cosmiconfig('pg');
export async function getPgConfig(searchFrom?: string): Promise<PgConfig> {
  return parseResult(await explorer.search(searchFrom));
}
export function getPgConfigSync(searchFrom?: string): PgConfig {
  return parseResult(explorer.searchSync(searchFrom));
}

export function readPgConfigSync(filename: string): PgConfig {
  return parseResult(explorer.loadSync(filename));
}

function parseResult(result: cosmiconfig.CosmiconfigResult): PgConfig {
  return PgConfigSchema.parse(result ? result.config : {});
}

export const DEFAULT_CONFIG = PgConfigSchema.parse({});
export default PgConfig;

export {
  PgTypesDomainTypeMode,
  PgTypesEnumTypeMode,
  PgTypesPrimaryKeyTypeMode,
} from './PgConfig';
