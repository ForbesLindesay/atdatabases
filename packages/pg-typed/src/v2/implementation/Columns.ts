import {SQLQuery} from '@databases/pg';
import {columnReference} from './Operators';
import {Columns} from '../types/Columns';

const IS_PROXIED = Symbol('IS_PROXIED');

export function columns<TRecord>(
  tableName: string,
  schema?: {
    columnName: string;
    postgresTypeQuery?: SQLQuery;
    postgresType?: string;
  }[],
  isAlias: boolean = false,
): Columns<TRecord> {
  if (schema) {
    return Object.fromEntries(
      schema.map(({columnName, postgresTypeQuery, postgresType}) => [
        columnName,
        columnReference(
          tableName,
          columnName,
          isAlias,
          postgresTypeQuery,
          postgresType,
        ),
      ]),
    ) as Columns<TRecord>;
  } else {
    return new Proxy(
      {},
      {
        get: (_target, columnName, _receiver) => {
          if (columnName === IS_PROXIED) return true;
          if (columnName === 'then' || typeof columnName !== 'string') {
            return undefined;
          }
          return columnReference(tableName, columnName, isAlias);
        },
      },
    ) as any;
  }
}

const cache = new Map<string, WeakMap<Columns<any>, Columns<any>>>();
export function aliasColumns<TRecord>(
  tableAlias: string,
  columns: Columns<TRecord>,
): Columns<TRecord> {
  let cachedAlias = cache.get(tableAlias);
  if (!cachedAlias) {
    cachedAlias = new WeakMap();
    cache.set(tableAlias, cachedAlias);
  }
  const cached = cachedAlias.get(columns);
  if (cached) return cached;
  const aliasedColumns = (columns as any)[IS_PROXIED]
    ? aliasColumnsByProxy(tableAlias, columns)
    : aliasColumnsWithPlainObject(tableAlias, columns);
  cachedAlias.set(columns, aliasedColumns);
  return aliasedColumns;
}

function aliasColumnsByProxy<TRecord>(
  tableAlias: string,
  columns: Columns<TRecord>,
): Columns<TRecord> {
  return new Proxy(
    {},
    {
      get: (_target, columnName, _receiver) => {
        if (columnName === IS_PROXIED) return true;
        const column = columns[columnName as keyof typeof columns];
        if (column === undefined) return column;
        return column.setAlias(tableAlias);
      },
    },
  ) as Columns<TRecord>;
}

function aliasColumnsWithPlainObject<TRecord>(
  tableAlias: string,
  columns: Columns<TRecord>,
): Columns<TRecord> {
  return Object.fromEntries(
    Object.entries(columns).map(([columnName, column]) => [
      columnName,
      (column as Columns<TRecord>[keyof Columns<TRecord>]).setAlias(tableAlias),
    ]),
  ) as Columns<TRecord>;
}
