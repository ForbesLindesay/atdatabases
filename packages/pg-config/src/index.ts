import {cosmiconfig, cosmiconfigSync} from 'cosmiconfig';
import {type PgConfig, PgConfigSchema} from './PgConfig';

const asyncExplorer = cosmiconfig('pg');
const syncExplorer = cosmiconfigSync('pg');
export async function getPgConfig(searchFrom?: string): Promise<PgConfig> {
  return parseResult(await asyncExplorer.search(searchFrom));
}
export function getPgConfigSync(searchFrom?: string): PgConfig {
  return parseResult(syncExplorer.search(searchFrom));
}

export function readPgConfigSync(filename: string): PgConfig {
  return parseResult(syncExplorer.load(filename));
}

function parseResult(result: null | {config: unknown}): PgConfig {
  return PgConfigSchema.parse(result ? result.config : {});
}

export const DEFAULT_CONFIG: PgConfig = PgConfigSchema.parse({});
export type {PgConfig as default};

export {
  PgTypesDomainTypeMode,
  PgTypesEnumTypeMode,
  PgTypesPrimaryKeyTypeMode,
} from './PgConfig';
