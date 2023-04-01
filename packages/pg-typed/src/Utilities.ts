import assertNever from 'assert-never';
import {SQLQuery, Queryable} from '@databases/pg';

class ComputedValue<T> {
  protected readonly __query: (
    sql: Queryable['sql'],
    toValue: (value: unknown) => unknown,
  ) => SQLQuery;
  constructor(
    query: (
      sql: Queryable['sql'],
      toValue: (value: unknown) => unknown,
    ) => SQLQuery,
  ) {
    this.__query = query;
  }
  protected __checkFieldValueType(): T {
    throw new Error(
      'This method is only there to help TypeScript interpret the type',
    );
  }
  static query<T>(
    q: Value<T>,
    sql: Queryable['sql'],
    toValue: (value: unknown) => unknown,
  ): SQLQuery {
    if (q && q instanceof ComputedValue) {
      return q.__query(sql, toValue);
    }
    if (typeof sql.isSqlQuery === 'function' && sql.isSqlQuery(q)) {
      return q;
    }
    return sql.value(toValue(q));
  }
}
export type {ComputedValue};
export type Value<T> = T | ComputedValue<T> | SQLQuery;

export type InsertParameters<TInsertParameters> = {
  [TColumnName in keyof TInsertParameters]: Value<
    TInsertParameters[TColumnName]
  >;
};

export type UpdateParameters<TRecord> = {
  [TColumnName in keyof TRecord]?: FieldUpdate<TRecord[TColumnName]>;
};

type SpecialFieldQuery<T> =
  | {
      type: 'json_path';
      path: readonly string[];
      query: T | FieldQuery<T>;
    }
  | {type: 'case_insensitive'; query: T | FieldQuery<T>}
  | {type: 'not'; query: T | FieldQuery<T>};

class FieldQuery<T> {
  protected readonly __query: (
    columnName: SQLQuery,
    sql: Queryable['sql'],
    toValue: (value: unknown) => unknown,
  ) => SQLQuery | 'TRUE' | 'FALSE';
  protected readonly __special: SpecialFieldQuery<T> | undefined;
  constructor(
    query: (
      columnName: SQLQuery,
      sql: Queryable['sql'],
      toValue: (value: unknown) => unknown,
    ) => SQLQuery | 'TRUE' | 'FALSE',
    special?: SpecialFieldQuery<T>,
  ) {
    this.__query = query;
    this.__special = special;
  }
  protected __checkFieldType(): T {
    throw new Error(
      'This method is only there to help TypeScript interpret the type',
    );
  }
  static query<T>(
    columnName: SQLQuery,
    q: FieldQuery<T> | unknown,
    sql: Queryable['sql'],
    toValue: (value: unknown) => unknown,
  ): SQLQuery | 'TRUE' | 'FALSE' {
    if (q === null) {
      return sql`${columnName} IS NULL`;
    }
    if (q && q instanceof FieldQuery) {
      return q.__query(columnName, sql, toValue);
    }

    return sql`${columnName} = ${toValue(q)}`;
  }
  static getSpecial<T>(q: T | FieldQuery<T>) {
    if (q && q instanceof FieldQuery) {
      return q.__special;
    } else {
      return undefined;
    }
  }
}

export type {FieldQuery};

export function anyOf<T>(values: {
  [Symbol.iterator](): IterableIterator<T | FieldQuery<T>>;
}): T | FieldQuery<T> {
  const valuesSet = new Set<T>();
  const parts: FieldQuery<T>[] = [];
  const caseInsensitiveParts: (T | FieldQuery<T>)[] = [];
  const negatedParts: (T | FieldQuery<T>)[] = [];
  for (const value of values) {
    if (value === null) {
      parts.push(
        new FieldQuery<T>((columnName, sql, toValue) =>
          FieldQuery.query(columnName, null, sql, toValue),
        ),
      );
    } else if (value instanceof FieldQuery) {
      const special = FieldQuery.getSpecial(value);
      if (special?.type === 'case_insensitive') {
        caseInsensitiveParts.push(special.query);
      } else if (special?.type === 'not') {
        negatedParts.push(special.query);
      } else {
        parts.push(value);
      }
    } else {
      valuesSet.add(value);
    }
  }
  if (caseInsensitiveParts.length) {
    parts.push(caseInsensitive(anyOf(caseInsensitiveParts) as any) as any);
  }
  if (negatedParts.length) {
    const negated = not(allOf(negatedParts));
    if (negated && negated instanceof FieldQuery) {
      parts.push(negated);
    } else {
      valuesSet.add(negated);
    }
  }
  if (valuesSet.size) {
    if (valuesSet.size === 1) {
      parts.push(
        new FieldQuery<T>((columnName, sql, toValue) =>
          FieldQuery.query(columnName, [...valuesSet][0], sql, toValue),
        ),
      );
    } else {
      parts.push(
        new FieldQuery<T>(
          (columnName, sql, toValue) =>
            sql`${columnName} = ANY(${[...valuesSet].map((v) => toValue(v))})`,
        ),
      );
    }
  }
  return new FieldQuery<T>((columnName, sql, toValue) => {
    const sqlParts: SQLQuery[] = [];
    for (const p of parts) {
      const part = FieldQuery.query(columnName, p, sql, toValue);
      if (part === 'TRUE') return 'TRUE';
      if (part !== 'FALSE') sqlParts.push(part);
    }
    if (sqlParts.length === 0) return 'FALSE';
    if (sqlParts.length === 1) return sqlParts[0];
    return sql`(${sql.join(sqlParts, ' OR ')})`;
  });
}

export function allOf<T>(values: {
  [Symbol.iterator](): IterableIterator<T | FieldQuery<T>>;
}): T | FieldQuery<T> {
  const valuesSet = new Set<T>();
  const parts: FieldQuery<T>[] = [];
  const negated: (T | FieldQuery<T>)[] = [];
  for (const q of values) {
    if (q && q instanceof FieldQuery) {
      const special = FieldQuery.getSpecial(q);
      if (special?.type === 'not') {
        negated.push(special.query);
      } else {
        parts.push(q);
      }
    } else {
      valuesSet.add(q);
    }
  }
  if (negated.length) {
    const n = not(anyOf(negated));
    if (n && n instanceof FieldQuery) {
      parts.push(n);
    } else {
      valuesSet.add(n);
    }
  }
  if (valuesSet.size > 1) {
    return new FieldQuery<T>(() => `FALSE`);
  } else if (valuesSet.size) {
    parts.push(
      new FieldQuery<T>((columnName, sql, toValue) =>
        FieldQuery.query(columnName, [...valuesSet][0], sql, toValue),
      ),
    );
  }
  return new FieldQuery<T>((columnName, sql, toValue) => {
    const sqlParts: SQLQuery[] = [];
    for (const p of parts) {
      const part = FieldQuery.query(columnName, p, sql, toValue);
      if (part === 'FALSE') return 'FALSE';
      if (part !== 'TRUE') sqlParts.push(part);
    }
    if (sqlParts.length === 0) return 'TRUE';
    if (sqlParts.length === 1) return sqlParts[0];
    return sql`(${sql.join(sqlParts, ' AND ')})`;
  });
}

export function not<T>(value: T | FieldQuery<T>): T | FieldQuery<T> {
  const special = FieldQuery.getSpecial(value);
  if (special?.type === 'not') {
    return special.query;
  }
  return new FieldQuery<T>(
    (columnName, sql, toValue) => {
      const subQuery = FieldQuery.query(columnName, value, sql, toValue);
      if (subQuery === 'TRUE') return 'FALSE';
      if (subQuery === 'FALSE') return 'TRUE';
      return sql`NOT (${subQuery})`;
    },
    {type: 'not', query: value},
  );
}

function internalInQueryResults(
  query: (sql: Queryable['sql']) => SQLQuery | 'FALSE',
): FieldQuery<any> {
  return new FieldQuery<any>((columnName, sql) => {
    const subQuery = query(sql);
    if (!sql.isSqlQuery(subQuery)) return subQuery;
    return sql`${columnName} IN (${subQuery})`;
  });
}

export function inQueryResults(query: SQLQuery): FieldQuery<any> {
  return internalInQueryResults(() => query);
}

export function lessThan<T>(value: Value<T>): FieldQuery<T> {
  return new FieldQuery<T>(
    (columnName, sql, toValue) =>
      sql`${columnName} < ${ComputedValue.query(value, sql, toValue)}`,
  );
}
export function lessThanOrEqualTo<T>(value: Value<T>): FieldQuery<T> {
  return new FieldQuery<T>(
    (columnName, sql, toValue) =>
      sql`${columnName} <= ${ComputedValue.query(value, sql, toValue)}`,
  );
}

export function greaterThan<T>(value: Value<T>): FieldQuery<T> {
  return new FieldQuery<T>(
    (columnName, sql, toValue) =>
      sql`${columnName} > ${ComputedValue.query(value, sql, toValue)}`,
  );
}
export function greaterThanOrEqualTo<T>(value: Value<T>): FieldQuery<T> {
  return new FieldQuery<T>(
    (columnName, sql, toValue) =>
      sql`${columnName} >= ${ComputedValue.query(value, sql, toValue)}`,
  );
}

export function jsonPath(
  path: readonly string[],
  query: any | FieldQuery<any>,
): FieldQuery<any> {
  return new FieldQuery<any>(
    (columnName, sql, toValue) =>
      FieldQuery.query(sql`${columnName}#>${path}`, query, sql, toValue),
    {type: 'json_path', path, query},
  );
}

export function caseInsensitive(
  query: string | FieldQuery<string>,
): FieldQuery<string> {
  const special = FieldQuery.getSpecial(query);
  if (special?.type === 'json_path') {
    return jsonPath(special.path, caseInsensitive(special.query));
  }
  return new FieldQuery<string>(
    (columnName, sql, toValue) =>
      FieldQuery.query(
        sql`LOWER(CAST(${columnName} AS TEXT))`,
        query,
        sql,
        (v) => `${toValue(v)}`.toLowerCase(),
      ),
    {type: 'case_insensitive', query},
  );
}

class WhereCombinedCondition<TRecord> {
  protected readonly __conditions: readonly WhereCondition<TRecord>[];
  protected readonly __combiner: 'AND' | 'OR';
  constructor(
    conditions: readonly WhereCondition<TRecord>[],
    combiner: 'AND' | 'OR',
  ) {
    this.__conditions = conditions;
    this.__combiner = combiner;
  }
  static query<T>(
    recordIdentifier: string | null,
    q: WhereCondition<T>,
    sql: Queryable['sql'],
    toValue: (columnName: string, value: unknown) => unknown,
    parentType?: 'AND' | 'OR',
  ): SQLQuery | 'TRUE' | 'FALSE' {
    if (q instanceof WhereCombinedCondition) {
      const conditions = q.__conditions.map((c) =>
        WhereCombinedCondition.query(
          recordIdentifier,
          c,
          sql,
          toValue,
          q.__combiner,
        ),
      );
      const significantConditions: SQLQuery[] = [];
      switch (q.__combiner) {
        case 'AND': {
          for (const c of conditions) {
            if (c === 'FALSE') return 'FALSE';
            if (c !== 'TRUE') significantConditions.push(c);
          }
          if (!significantConditions.length) return 'TRUE';
          if (significantConditions.length === 1) {
            return significantConditions[0];
          }
          const query = sql.join(significantConditions, sql` AND `);
          return parentType === 'OR' ? sql`(${query})` : query;
        }
        case 'OR': {
          for (const c of conditions) {
            if (c === 'TRUE') return 'TRUE';
            if (c !== 'FALSE') significantConditions.push(c);
          }
          if (!significantConditions.length) return 'FALSE';
          if (significantConditions.length === 1) {
            return significantConditions[0];
          }
          const query = sql.join(significantConditions, sql` OR `);
          return parentType === 'AND' ? sql`(${query})` : query;
        }
        default:
          return assertNever(q.__combiner);
      }
    }
    if (typeof sql.isSqlQuery === 'function' && sql.isSqlQuery(q)) {
      return q;
    }

    const entries = Object.entries(q);
    const fieldTests: SQLQuery[] = [];
    for (const [columnName, value] of entries) {
      const sqlFieldTest = FieldQuery.query(
        recordIdentifier
          ? sql.ident(recordIdentifier, columnName)
          : sql.ident(columnName),
        value,
        sql,
        (v) => toValue(columnName, v),
      );
      if (sqlFieldTest === 'FALSE') return 'FALSE';
      if (sqlFieldTest !== 'TRUE') fieldTests.push(sqlFieldTest);
    }
    if (fieldTests.length === 0) {
      return 'TRUE';
    }
    if (fieldTests.length === 1) {
      return fieldTests[0];
    }
    const query = sql.join(fieldTests, sql` AND `);
    return parentType === 'OR' ? sql`(${query})` : query;
  }
}
export type {WhereCombinedCondition};

export type WhereCondition<TRecord> =
  | Partial<{
      readonly [key in keyof TRecord]: TRecord[key] | FieldQuery<TRecord[key]>;
    }>
  | WhereCombinedCondition<TRecord>
  | SQLQuery;

export function and<TRecord>(
  ...conditions: readonly WhereCondition<TRecord>[]
): WhereCondition<TRecord> {
  return new WhereCombinedCondition(conditions, 'AND');
}
export function or<TRecord>(
  ...conditions: readonly WhereCondition<TRecord>[]
): WhereCondition<TRecord> {
  return new WhereCombinedCondition(conditions, 'OR');
}

export type FieldUpdate<T> = Value<T> | ComputedFieldUpdate<T>;
export class ComputedFieldUpdate<T> {
  protected readonly __query: (
    columnName: SQLQuery,
    sql: Queryable['sql'],
    toValue: (value: unknown) => unknown,
  ) => SQLQuery;
  constructor(
    query: (
      columnName: SQLQuery,
      sql: Queryable['sql'],
      toValue: (value: unknown) => unknown,
    ) => SQLQuery,
  ) {
    this.__query = query;
  }
  protected __checkFieldUpdateType(): T {
    throw new Error(
      'This method is only there to help TypeScript interpret the type',
    );
  }
  static query<T>(
    columnName: SQLQuery,
    q: FieldUpdate<T>,
    sql: Queryable['sql'],
    toValue: (value: unknown) => unknown,
  ): SQLQuery {
    if (q && q instanceof ComputedFieldUpdate) {
      return q.__query(columnName, sql, toValue);
    }

    return sql`${ComputedValue.query(q, sql, toValue)}`;
  }
}

type Interval = `${number} ${
  | 'SECOND'
  | 'MINUTE'
  | 'HOUR'
  | 'DAY'
  | 'WEEK'
  | 'MONTH'
  | 'YEAR'}`;
export function add(count: Value<number>): FieldUpdate<number>;
export function add(a: Value<number>, b?: Value<number>): Value<number>;
export function add(interval: Interval): FieldUpdate<Date>;
export function add(timestamp: Value<Date>, interval: Interval): Value<Date>;
export function add(
  a: Value<number> | Value<Date> | Interval,
  b?: Value<number> | Interval,
): FieldUpdate<number> | Value<number> | FieldUpdate<Date> | Value<Date> {
  if (typeof a === 'string') {
    return new ComputedFieldUpdate<Date>(
      (columnName, sql) => sql`${columnName}+${a}`,
    );
  }
  if (typeof b === 'string') {
    return new ComputedValue<Date>(
      (sql, toValue) => sql`${ComputedValue.query(a, sql, toValue)}+${b}`,
    );
  }
  if (b === undefined) {
    return new ComputedFieldUpdate<number>(
      (columnName, sql, toValue) =>
        sql`${columnName}+${ComputedValue.query(a, sql, toValue)}`,
    );
  }
  return new ComputedValue<number>(
    (sql, toValue) =>
      sql`${ComputedValue.query(a, sql, toValue)}+${ComputedValue.query(
        b,
        sql,
        toValue,
      )}`,
  );
}
const CURRENT_TIMESTAMP = new ComputedValue<Date>(
  (sql) => sql`CURRENT_TIMESTAMP`,
);
export function currentTimestamp(): Value<Date> {
  return CURRENT_TIMESTAMP;
}

class ExcludedValue {
  protected readonly __type: 'EXCLUDED_VALUE' = 'EXCLUDED_VALUE';
}
const EXCLUDED_VALUE = new ExcludedValue();
export function excludedValue() {
  return EXCLUDED_VALUE;
}
export function isExcludedValue<T>(value: unknown): value is ExcludedValue {
  return !!(value && value instanceof ExcludedValue);
}
export type {ExcludedValue};
