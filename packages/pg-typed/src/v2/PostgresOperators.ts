import {SQLQuery, sql} from '@databases/pg';

// https://www.postgresql.org/docs/15/sql-syntax-lexical.html#SQL-PRECEDENCE

export interface BinaryInput {
  left: SQLQuery;
  right: SQLQuery;
}

export interface OperatorDefinition<TInput> {
  readonly toSql: (
    input: TInput,
    ctx: {parentOperatorPrecedence: number | null},
  ) => SQLQuery;
  readonly precedence: number;
  // readonly staticValue?: (input: TStaticValueInput) => boolean | null;
}

function operatorDefinition<TInput>(
  toSql: (input: TInput) => SQLQuery,
  precedence: number,
  options: Omit<OperatorDefinition<TInput>, 'toSql' | 'precedence'> = {},
): OperatorDefinition<TInput> {
  return {
    toSql: (input, ctx) => {
      const expression = toSql(input);
      if (
        ctx.parentOperatorPrecedence !== null &&
        ctx.parentOperatorPrecedence <= precedence
      ) {
        return sql`(${expression})`;
      } else {
        return expression;
      }
    },
    precedence,
    ...options,
  };
}

export const OperatorDefinitions = {
  // table/column name separator
  TABLE_COLUMN: operatorDefinition(
    (p: {tableAlias?: string; columnName: string}) =>
      p.tableAlias === undefined
        ? sql.ident(p.columnName)
        : sql.ident(p.tableAlias, p.columnName),
    1,
  ),

  // PostgreSQL-style typecast
  TYPECAST: operatorDefinition(
    (p: {expression: SQLQuery; type: SQLQuery}) =>
      sql`${p.expression}::${p.type}`,
    2,
  ),

  // array element selection
  ARRAY_ELEMENT_SELECTION: operatorDefinition(
    (p: {expression: SQLQuery; index: SQLQuery}) =>
      sql`${p.expression}[${p.index}]`,
    3,
  ),

  // unary plus, unary minus
  UNARY_PLUS: operatorDefinition((exp: SQLQuery) => sql`+${exp}`, 4),
  UNARY_MINUS: operatorDefinition((exp: SQLQuery) => sql`-${exp}`, 4),

  // exponentiation
  EXPONENTIATION: operatorDefinition(
    (p: BinaryInput) => sql`${p.left}^${p.right}`,
    5,
  ),

  // multiplication, division, modulo
  MULTIPLICATION: operatorDefinition((p: SQLQuery[]) => sql.join(p, sql`*`), 6),
  DIVISION: operatorDefinition((p: SQLQuery[]) => sql.join(p, sql`/`), 6),
  MODULUS: operatorDefinition((p: SQLQuery[]) => sql.join(p, sql`%`), 6),

  // addition, subtraction
  ADDITION: operatorDefinition((p: SQLQuery[]) => sql.join(p, sql`+`), 7),
  SUBTRACTION: operatorDefinition((p: SQLQuery[]) => sql.join(p, sql`-`), 7),

  // ... any other operator ...
  CUSTOM: operatorDefinition((expression: SQLQuery) => expression, 8),

  // range containment, set membership, string matching
  BETWEEN: operatorDefinition(
    (p: {expression: SQLQuery; lower: SQLQuery; upper: SQLQuery}) =>
      sql`${p.expression} BETWEEN ${p.lower} AND ${p.upper}`,
    9,
  ),
  IN: operatorDefinition(
    (p: {expression: SQLQuery; set: SQLQuery}) =>
      sql`${p.expression} IN ${p.set}`,
    9,
  ),
  LIKE: operatorDefinition(
    (p: BinaryInput) => sql`${p.left} LIKE ${p.right}`,
    9,
  ),
  ILIKE: operatorDefinition(
    (p: BinaryInput) => sql`${p.left} ILIKE ${p.right}`,
    9,
  ),
  SIMILAR: operatorDefinition(
    (p: {
      expression: SQLQuery;
      pattern: SQLQuery;
      escapeCharacter?: SQLQuery;
    }) =>
      p.escapeCharacter
        ? sql`${p.expression} SIMILAR TO ${p.pattern} ESCAPE ${p.escapeCharacter}`
        : sql`${p.expression} SIMILAR TO ${p.pattern}`,
    9,
  ),

  // comparison operators
  LT: operatorDefinition((p: BinaryInput) => sql`${p.left}<${p.right}`, 10),
  GT: operatorDefinition((p: BinaryInput) => sql`${p.left}>${p.right}`, 10),
  LTE: operatorDefinition((p: BinaryInput) => sql`${p.left}<=${p.right}`, 10),
  GTE: operatorDefinition((p: BinaryInput) => sql`${p.left}>=${p.right}`, 10),
  EQ: operatorDefinition((p: BinaryInput) => sql`${p.left}=${p.right}`, 10),
  NEQ: operatorDefinition((p: BinaryInput) => sql`${p.left}<>${p.right}`, 10),

  // IS
  IS_NULL: operatorDefinition((exp: SQLQuery) => sql`${exp} IS NULL`, 11),
  IS_NOT_NULL: operatorDefinition(
    (exp: SQLQuery) => sql`${exp} IS NOT NULL`,
    11,
  ),

  // NOT
  NOT: operatorDefinition((exp: SQLQuery) => sql`NOT ${exp}`, 12, {
    // staticValue: (input: boolean | null) => {
    //   if (input === null) return null;
    //   return !input;
    // },
  }),

  // AND
  AND: operatorDefinition((parts: SQLQuery[]) => sql.join(parts, ` AND `), 13, {
    // staticValue: (parts: (boolean | null)[]) => {
    //   if (parts.every((p) => p === true)) return true;
    //   if (parts.some((p) => p === false)) return false;
    //   return null;
    // },
  }),

  // OR
  OR: operatorDefinition((parts: SQLQuery[]) => sql.join(parts, ` OR `), 14, {
    // staticValue: (parts: (boolean | null)[]) => {
    //   if (parts.some((p) => p === true)) return true;
    //   if (parts.every((p) => p === false)) return false;
    //   return null;
    // },
  }),
} as const;

export type Operator = keyof typeof OperatorDefinitions;
