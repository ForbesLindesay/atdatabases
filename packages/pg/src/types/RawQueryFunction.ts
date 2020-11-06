import {QueryConfig} from 'pg';

type RawQueryFunction = (
  query: string | QueryConfig,
  values?: any[],
) => Promise<unknown>;
export default RawQueryFunction;
