import {columnReference} from './Operators';
import {ColumnReference, Columns} from '../types/Columns';

const IS_PROXIED = Symbol('IS_PROXIED');

function baseToValue(value: unknown): unknown {
  return value;
}
function jsonToValue(value: unknown): unknown {
  return JSON.stringify(value);
}
function jsonArrayToValue(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((v) => JSON.stringify(v));
}

export function columns<TRecord>(
  tableName: string,
  schema?: {
    columnName: string;
    type?: string;
  }[],
  isAlias: boolean = false,
): Columns<TRecord> {
  if (schema) {
    return Object.assign(
      {__isSpecialValue: true, __tableName: tableName},
      Object.fromEntries(
        schema.map(({columnName, type}) => [
          columnName,
          columnReference(
            tableName,
            columnName,
            isAlias,
            type ?? null,
            type === `JSON` || type === `JSONB`
              ? jsonToValue
              : type === `JSON[]` || type === `JSONB[]`
              ? jsonArrayToValue
              : baseToValue,
          ),
        ]),
      ),
    ) as Columns<TRecord>;
  } else {
    return new Proxy(
      {},
      {
        get: (_target, columnName, _receiver) => {
          if (columnName === IS_PROXIED) return true;
          if (columnName === `__isSpecialValue`) return true;
          if (columnName === `__tableName`) return tableName;
          if (columnName === 'then' || typeof columnName !== 'string') {
            return undefined;
          }
          return columnReference(
            tableName,
            columnName,
            isAlias,
            null,
            baseToValue,
          );
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
  const cached = cachedAlias.get(columns as any);
  if (cached) return cached as any;
  const aliasedColumns = (columns as any)[IS_PROXIED]
    ? aliasColumnsByProxy(tableAlias, columns)
    : aliasColumnsWithPlainObject(tableAlias, columns);
  cachedAlias.set(columns as any, aliasedColumns as any);
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
        if (columnName === `__isSpecialValue`) return true;
        if (columnName === `__tableName`) return tableAlias;
        const column = columns[columnName as keyof typeof columns];
        if (column === undefined) return column;
        return (column as ColumnReference<unknown>).setAlias(tableAlias);
      },
    },
  ) as Columns<TRecord>;
}

function aliasColumnsWithPlainObject<TRecord>(
  tableAlias: string,
  columns: Columns<TRecord>,
): Columns<TRecord> {
  return Object.assign(
    {__isSpecialValue: true, __tableName: tableAlias},
    Object.fromEntries(
      Object.entries(columns)
        .filter(([n]) => n !== '__isSpecialValue' && n !== '__tableName')
        .map(([columnName, column]) => [
          columnName,
          (column as any as ColumnReference<unknown>).setAlias(tableAlias),
        ]),
    ),
  ) as Columns<TRecord>;
}
