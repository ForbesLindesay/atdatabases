import {SQLQuery, sql} from '@databases/pg';
import Value, {
  AggregatedTypedValue,
  FieldCondition,
  ComputedFieldCondition,
  isSpecialValue,
  NonAggregatedTypedValue,
  FieldConditionToSqlContext,
  RawValue,
  AnyOf,
  ValueToSqlContext,
  BaseAggregatedTypedValue,
  isComputedFieldQuery,
  ComputedValue,
  AggregatedValue,
  isAnyOfCondition,
} from '../types/SpecialValues';
import {
  BinaryInput,
  OperatorDefinition,
  OperatorDefinitions,
} from '../PostgresOperators';
import {IOperators, List} from '../types/Operators';
import {ColumnReference} from '../types/Columns';

export function columnReference<T>(
  tableName: string,
  columnName: string,
  isAlias: boolean,
  postgresTypeQuery?: SQLQuery,
  postgresType?: string,
): Value<T> {
  return new ColumnReferenceImplementation(
    tableName,
    columnName,
    isAlias,
    postgresTypeQuery,
    postgresType,
  );
}

export function fieldConditionToPredicateValue<T>(
  column: ColumnReference<T>,
  f: FieldCondition<T>,
): Value<boolean> {
  const constantValue = fieldConditionToConstant(f);
  if (constantValue !== null) return constantValue;
  return new FieldConditionValue(column, f);
}

export function valueToSelect<T>(
  alias: string,
  value: Value<T> | AggregatedValue<T>,
): SQLQuery {
  if (
    value instanceof ColumnReferenceImplementation &&
    value.columnName === alias
  ) {
    return valueToSql(value, {
      parentOperatorPrecedence: null,
      toValue: (v) => v,
      tableAlias: () => null,
    });
  }
  return sql`${valueToSql(value, {
    parentOperatorPrecedence: null,
    toValue: (v) => v,
    tableAlias: () => null,
  })} AS ${sql.ident(alias)}`;
}

export function aliasTableInValue<T>(
  tableName: string,
  tableAlias: string,
  value: Value<T>,
): Value<T> {
  if (!isSpecialValue(value)) {
    return value;
  }
  return new AliasTableInValue(tableName, tableAlias, value);
}

export function valueToSql<T>(
  value: Value<T> | BaseAggregatedTypedValue<T>,
  ctx: ValueToSqlContext,
): SQLQuery {
  if (isSpecialValue(value)) return value.toSql(ctx);
  if (sql.isSqlQuery(value)) {
    if (ctx.parentOperatorPrecedence !== null) {
      return sql`(${value})`;
    }
    return value;
  }
  return sql.value(ctx.toValue(value));
}

const STAR = {}; // marker value for the "*" in COUNT(*)
const AGGREGATE_FUNCTIONS = {
  MAX: sql`MAX`,
  MIN: sql`MIN`,
  SUM: sql`SUM`,
  COUNT: sql`COUNT`,
};

const NON_AGGREGATE_FUNCTIONS = {
  LOWER: sql`LOWER`,
  UPPER: sql`UPPER`,
};

const ORDER_BY_DIRECTION = {
  ASC: sql`ASC`,
  DESC: sql`DESC`,
};

abstract class BaseExpression<T>
  implements BaseAggregatedTypedValue<T>, NonAggregatedTypedValue<T>
{
  public readonly __isSpecialValue = true;
  public readonly __isAggregatedValue = true;
  public readonly __isNonAggregatedComputedValue = true;

  public abstract toSql(ctx: ValueToSqlContext): SQLQuery;
  public __getType(): T {
    throw new Error(
      `The "getType" function should not be called. It is only there to help TypeScript infer the correct type.`,
    );
  }
}

abstract class BaseFieldQuery<T> implements ComputedFieldCondition<T> {
  public readonly __isSpecialValue = true;
  public readonly __isFieldQuery = true;
  public __getType(): T {
    throw new Error(
      `The "getType" function should not be called. It is only there to help TypeScript infer the correct type.`,
    );
  }
  public abstract getStaticValue(): boolean | null;
  public abstract toSqlCondition(ctx: FieldConditionToSqlContext): SQLQuery;
}

class ColumnReferenceImplementation<T>
  extends BaseExpression<T>
  implements ColumnReference<T>
{
  public readonly tableName: string;
  public readonly columnName: string;
  public readonly isAlias: boolean;

  // TODO: make use of schema info
  public readonly postgresTypeQuery: SQLQuery | undefined;
  public readonly postgresType: string | undefined;

  constructor(
    tableName: string,
    columnName: string,
    isAlias: boolean,
    postgresTypeQuery: SQLQuery | undefined,
    postgresType: string | undefined,
  ) {
    super();
    this.tableName = tableName;
    this.columnName = columnName;
    this.isAlias = isAlias;
    this.postgresTypeQuery = postgresTypeQuery;
    this.postgresType = postgresType;
  }
  public toSql(ctx: ValueToSqlContext): SQLQuery {
    if (this.isAlias) {
      return sql.ident(this.tableName, this.columnName);
    }
    const tableAlias = ctx.tableAlias(this.tableName);
    if (tableAlias) {
      return sql.ident(tableAlias, this.columnName);
    }
    return sql.ident(this.columnName);
  }
  public setAlias(tableAlias: string): ColumnReference<T> {
    return new ColumnReferenceImplementation(
      tableAlias,
      this.columnName,
      true,
      this.postgresTypeQuery,
      this.postgresType,
    );
  }
}

class OperatorExpression<
  TPreparedInput,
  TInput,
  TResult,
> extends BaseExpression<TResult> {
  public readonly op: OperatorDefinition<TPreparedInput>;
  public readonly input: TInput;
  public readonly prepareInput: (
    input: TInput,
    ctx: ValueToSqlContext,
  ) => TPreparedInput;

  constructor(
    op: OperatorDefinition<TPreparedInput>,
    input: TInput,
    prepareInput: (input: TInput, ctx: ValueToSqlContext) => TPreparedInput,
  ) {
    super();
    this.op = op;
    this.input = input;
    this.prepareInput = prepareInput;
  }

  public toSql(ctx: ValueToSqlContext): SQLQuery {
    return this.op.toSql(
      this.prepareInput(this.input, {
        ...ctx,
        parentOperatorPrecedence: this.op.precedence,
      }),
      ctx,
    );
  }
}

class OperatorFieldQuery<
  TPreparedInput,
  TInput,
  TLeft,
> extends BaseFieldQuery<TLeft> {
  public readonly op: OperatorDefinition<TPreparedInput>;
  public readonly input: TInput;
  public readonly prepareInput: (
    input: TInput,
    ctx: FieldConditionToSqlContext,
  ) => TPreparedInput;
  public readonly staticValue: boolean | null;

  constructor(
    op: OperatorDefinition<TPreparedInput>,
    input: TInput,
    prepareInput: (
      input: TInput,
      ctx: FieldConditionToSqlContext,
    ) => TPreparedInput,
    staticValue: boolean | null,
  ) {
    super();
    this.op = op;
    this.input = input;
    this.prepareInput = prepareInput;
    this.staticValue = staticValue;
  }

  public getStaticValue(): boolean | null {
    return this.staticValue;
  }

  public toSqlCondition(ctx: FieldConditionToSqlContext): SQLQuery {
    return this.op.toSql(
      this.prepareInput(this.input, {
        ...ctx,
        parentOperatorPrecedence: this.op.precedence,
      }),
      ctx,
    );
  }
}

class NonAggregateFunction<T> extends BaseExpression<T> {
  public readonly fn: keyof typeof NON_AGGREGATE_FUNCTIONS;
  public readonly values: Value<T>[];
  constructor(fn: keyof typeof NON_AGGREGATE_FUNCTIONS, values: Value<T>[]) {
    super();
    this.fn = fn;
    this.values = values;
  }
  public toSql(ctx: ValueToSqlContext): SQLQuery {
    return sql`${NON_AGGREGATE_FUNCTIONS[this.fn]}(${sql.join(
      this.values.map((v) =>
        valueToSql(v, {...ctx, parentOperatorPrecedence: null}),
      ),
      `, `,
    )})`;
  }
}

class AggregateFunction<TResult, TArg>
  extends BaseExpression<TResult>
  implements AggregatedTypedValue<TResult>
{
  public readonly fn: keyof typeof AGGREGATE_FUNCTIONS;
  public readonly values: Value<TArg>[];
  public readonly condition: undefined | Value<boolean>;
  public readonly orderByClauses: {
    direction: keyof typeof ORDER_BY_DIRECTION;
    value: Value<any>;
  }[];
  public readonly isDistinct: boolean;
  constructor(
    fn: keyof typeof AGGREGATE_FUNCTIONS,
    values: Value<TArg>[],
    condition?: Value<boolean>,
    orderBy?: Value<any>[],
    distinct?: boolean,
  ) {
    super();
    this.fn = fn;
    this.values = values;
    this.condition = condition;
    this.orderByClauses = orderBy ?? [];
    this.isDistinct = distinct ?? false;
  }
  public toSql(ctx: ValueToSqlContext): SQLQuery {
    const fn = AGGREGATE_FUNCTIONS[this.fn];
    let args = sql.join(
      this.values.map((v) => (v === STAR ? sql`*` : valueToSql(v, ctx))),
      `, `,
    );
    if (this.isDistinct) {
      args = sql`DISTINCT ${args}`;
    }
    if (this.orderByClauses.length) {
      args = sql`${args} ORDER BY ${sql.join(
        this.orderByClauses.map(
          (c) =>
            sql`${valueToSql(c.value, ctx)} ${ORDER_BY_DIRECTION[c.direction]}`,
        ),
        `, `,
      )}`;
    }
    if (this.condition !== undefined) {
      return sql`${fn}(${args}) FILTER (WHERE ${valueToSql(
        this.condition,
        ctx,
      )})`;
    }
    return sql`${fn}(${args})`;
  }

  public distinct(): AggregatedTypedValue<TResult> {
    return new AggregateFunction(
      this.fn,
      this.values,
      this.condition,
      this.orderByClauses,
      true,
    );
  }

  public orderByAsc<TOrderBy>(
    value: Value<TOrderBy>,
  ): AggregatedTypedValue<TResult> {
    return new AggregateFunction(
      this.fn,
      this.values,
      this.condition,
      [...this.orderByClauses, {direction: 'ASC', value}],
      this.isDistinct,
    );
  }

  public orderByDesc<TOrderBy>(
    value: Value<TOrderBy>,
  ): AggregatedTypedValue<TResult> {
    return new AggregateFunction(
      this.fn,
      this.values,
      this.condition,
      [...this.orderByClauses, {direction: 'DESC', value}],
      this.isDistinct,
    );
  }

  public filter(condition: Value<boolean>): AggregatedTypedValue<TResult> {
    return new AggregateFunction(
      this.fn,
      this.values,
      condition,
      this.orderByClauses,
      this.isDistinct,
    );
  }
}

class AllOf<T> extends BaseFieldQuery<T> {
  public readonly values: List<FieldCondition<T>>;
  constructor(values: List<FieldCondition<T>>) {
    super();
    this.values = values;
  }
  public getStaticValue(): boolean | null {
    const staticValues = [...this.values].map(fieldConditionToConstant);
    if (staticValues.every((v) => v === true)) return true;
    if (staticValues.some((v) => v === false)) return false;
    return null;
  }

  public toSqlCondition(ctx: FieldConditionToSqlContext): SQLQuery {
    const parts: FieldCondition<T>[] = [...this.values].filter(
      (part) => fieldConditionToConstant(part) !== true,
    );
    const partCount = parts.length;
    if (partCount === 0) return sql`TRUE`;

    const childCtx: FieldConditionToSqlContext = {
      ...ctx,
      parentOperatorPrecedence:
        partCount === 1
          ? ctx.parentOperatorPrecedence
          : OperatorDefinitions.AND.precedence,
    };

    const sqlParts = parts.map((p) => fieldConditionToSql(p, childCtx));

    if (sqlParts.length === 1) return sqlParts[0];

    return OperatorDefinitions.AND.toSql(sqlParts, ctx);
  }
}

class AnyOfImplementation<T> extends BaseFieldQuery<T> implements AnyOf<T> {
  public readonly __isAnyOf = true;
  public readonly values: Value<List<FieldCondition<T>>>;
  constructor(values: Value<List<FieldCondition<T>>>) {
    super();
    this.values = values;
  }
  public getStaticValue(): boolean | null {
    if (isSpecialValue(this.values) || sql.isSqlQuery(this.values)) return null;
    const staticValues = [...this.values].map(fieldConditionToConstant);
    if (staticValues.some((v) => v === true)) return true;
    if (staticValues.every((v) => v === false)) return false;
    return null;
  }

  public toSqlCondition(ctx: FieldConditionToSqlContext): SQLQuery {
    if (isSpecialValue(this.values) || sql.isSqlQuery(this.values)) {
      return OperatorDefinitions.EQ.toSql(
        {
          left: ctx.left,
          right: sql`ALL(${valueToSql(this.values, {
            ...ctx,
            parentOperatorPrecedence: OperatorDefinitions.EQ.precedence,
          })})`,
        },
        ctx,
      );
    }

    const values = new Set<RawValue<T>>();
    const parts: FieldCondition<T>[] = [];
    for (const value of this.values) {
      if (fieldConditionToConstant(value) !== false) {
        if (isSpecialValue(value)) {
          parts.push(value);
        } else {
          values.add(value);
        }
      }
    }
    const partCount = parts.length + (values.size ? 1 : 0);
    if (partCount === 0) return sql`FALSE`;

    const childCtx: FieldConditionToSqlContext = {
      ...ctx,
      parentOperatorPrecedence:
        partCount === 1
          ? ctx.parentOperatorPrecedence
          : OperatorDefinitions.OR.precedence,
    };

    const sqlParts = [
      ...parts.map((p) => fieldConditionToSql(p, childCtx)),
      ...(values.size
        ? [
            OperatorDefinitions.EQ.toSql(
              {
                left: ctx.left,
                right:
                  values.size > 1
                    ? sql`ANY(${[...values].map(ctx.toValue)})`
                    : sql.value(ctx.toValue([...values][0])),
              },
              childCtx,
            ),
          ]
        : []),
    ];

    if (sqlParts.length === 1) return sqlParts[0];

    return OperatorDefinitions.OR.toSql(sqlParts, ctx);
  }
}

class EqualsAnyOf<T> extends BaseExpression<boolean> {
  public readonly left: AggregatedValue<T> | Value<T>;
  public readonly right: AnyOf<T>;

  constructor(
    op: OperatorDefinition<BinaryInput>,
    left: AggregatedValue<T> | Value<T>,
    right: AnyOf<T>,
  ) {
    super();
    this.left = left;
    this.right = right;
  }

  public toSql(ctx: ValueToSqlContext): SQLQuery {
    return this.right.toSqlCondition({
      ...ctx,
      left: valueToSql(this.left, {
        ...ctx,
        parentOperatorPrecedence: OperatorDefinitions.EQ.precedence,
      }),
    });
  }
}

class CaseInsensitive extends BaseFieldQuery<string> {
  public readonly value: FieldCondition<string>;
  constructor(value: FieldCondition<string>) {
    super();
    this.value = value;
  }
  public getStaticValue(): boolean | null {
    return null;
  }

  public toSqlCondition(ctx: FieldConditionToSqlContext): SQLQuery {
    return fieldConditionToSql(this.value, {
      ...ctx,
      left: sql`LOWER(${ctx.left})`,
      toValue: (value) => {
        const v = ctx.toValue(value);
        if (typeof v === 'string') return v.toLowerCase();
        return v;
      },
    });
  }
}

function prepareBinaryOperatorExpression<TLeft, TRight>(
  {
    left,
    right,
  }: {
    left: AggregatedValue<TLeft> | Value<TLeft>;
    right: AggregatedValue<TRight> | Value<TRight>;
  },
  ctx: ValueToSqlContext,
) {
  return {left: valueToSql(left, ctx), right: valueToSql(right, ctx)};
}

function prepareBinaryOperatorFieldQuery<TRight>(
  right: RawValue<TRight>,
  ctx: FieldConditionToSqlContext,
) {
  return {left: ctx.left, right: sql.value(ctx.toValue(right))};
}

function binaryOperator(
  operator: OperatorDefinition<{left: SQLQuery; right: SQLQuery}>,
): (leftOrOnly: any, right?: any) => any {
  return <TLeft, TRight, TResult>(
    leftOrOnly: AggregatedValue<TLeft> | Value<TLeft> | RawValue<TRight>,
    right?: AggregatedValue<TRight> | Value<TRight> | AnyOf<TRight>,
  ):
    | (Value<TResult> & NonAggregatedTypedValue<TResult>)
    | FieldCondition<TLeft> => {
    if (right === undefined) {
      return new OperatorFieldQuery(
        operator,
        leftOrOnly as RawValue<TRight>,
        prepareBinaryOperatorFieldQuery,
        null,
      );
    } else if (isAnyOfCondition(right)) {
      if (operator !== OperatorDefinitions.EQ) {
        throw new Error(
          `The only operator that can be used with "anyOf" is "eq".`,
        );
      }
      if (
        right instanceof AnyOfImplementation &&
        !isSpecialValue(right.values) &&
        !sql.isSqlQuery(right.values) &&
        [...right.values].length === 0
      ) {
        // @ts-expect-error
        return false;
      }
      return new EqualsAnyOf<TLeft | TRight>(
        operator,
        leftOrOnly as AggregatedValue<TLeft> | Value<TLeft>,
        right,
      ) as any;
    } else {
      return new OperatorExpression(
        operator,
        {left: leftOrOnly as AggregatedValue<TLeft> | Value<TLeft>, right},
        prepareBinaryOperatorExpression,
      );
    }
  };
}

function prepareVariadicOperatorInput<TInput>(
  inputs: (Value<TInput> | AggregatedTypedValue<TInput>)[],
  ctx: ValueToSqlContext,
) {
  return inputs.map((input) => valueToSql(input, ctx));
}

function variadicOperator<TStaticValue = never>(
  operator: OperatorDefinition<SQLQuery[]>,
  getConstantValue?: (
    ...params: (Value<any> | AggregatedTypedValue<any>)[]
  ) => TStaticValue | undefined,
) {
  return <TInput, TResult>(
    ...params: (Value<TInput> | AggregatedTypedValue<TInput>)[]
  ):
    | TStaticValue
    | (BaseAggregatedTypedValue<TResult> &
        NonAggregatedTypedValue<TResult>) => {
    const flatParams = params.flatMap((p) => {
      if (p instanceof OperatorExpression && p.op === operator) {
        return p.input as (Value<any> | AggregatedTypedValue<any>)[];
      }
      return [p];
    });
    const constantValue = getConstantValue && getConstantValue(...flatParams);
    if (constantValue !== undefined) return constantValue;

    return new OperatorExpression(
      operator,
      flatParams,
      prepareVariadicOperatorInput,
    );
  };
}

function nonAggregateFunction(fn: keyof typeof NON_AGGREGATE_FUNCTIONS) {
  return <TArgs extends any[], TResult>(
    ...args: TArgs
  ): ComputedValue<TResult> => {
    return new NonAggregateFunction(fn, args);
  };
}

function aggregateFunction(fn: keyof typeof AGGREGATE_FUNCTIONS) {
  return <TArgs extends any[], TResult>(
    ...args: TArgs
  ): AggregatedTypedValue<TResult> => {
    return new AggregateFunction(fn, args);
  };
}

function fieldConditionToSql<T>(
  value: FieldCondition<T>,
  ctx: FieldConditionToSqlContext,
) {
  if (isSpecialValue(value)) return value.toSqlCondition(ctx);
  return OperatorDefinitions.EQ.toSql(
    {
      left: ctx.left,
      right: sql.value(ctx.toValue(value)),
    },
    ctx,
  );
}

function fieldConditionToConstant<T>(q: FieldCondition<T>): boolean | null {
  if (isSpecialValue(q)) return q.getStaticValue();
  return null;
}

function overload<TKey extends string>(
  overloads: Record<TKey, (...args: any[]) => any>,
  chooseOverload: (...args: any[]) => TKey,
) {
  return (...args: any[]): any => {
    return overloads[chooseOverload(...args)](...args);
  };
}

class FieldConditionValue<T> extends BaseExpression<boolean> {
  public readonly left: ColumnReference<T>;
  public readonly right: FieldCondition<T>;
  constructor(left: ColumnReference<T>, right: FieldCondition<T>) {
    super();
    this.left = left;
    this.right = right;
  }
  public toSql(ctx: ValueToSqlContext): SQLQuery {
    return fieldConditionToSql(this.right, {
      ...ctx,
      left: valueToSql(this.left, ctx),
    });
  }
}

class AliasTableInValue<T> extends BaseExpression<T> {
  public readonly tableName: string;
  public readonly tableAlias: string;
  public readonly value: Value<T>;
  constructor(tableName: string, tableAlias: string, value: Value<T>) {
    super();
    this.tableName = tableName;
    this.tableAlias = tableAlias;
    this.value = value;
  }
  public toSql(ctx: ValueToSqlContext): SQLQuery {
    return valueToSql(this.value, {
      ...ctx,
      tableAlias: (tableName: string) =>
        tableName === this.tableName
          ? this.tableAlias
          : ctx.tableAlias(tableName),
    });
  }
}

const Operators: IOperators = {
  allOf: (values) => new AllOf(values),
  and: variadicOperator(OperatorDefinitions.AND, (...params) => {
    if (params.every((p) => p === true)) return true;
    if (params.some((p) => p === false)) return false;
    return undefined;
  }),
  anyOf: (values) => new AnyOfImplementation(values),
  caseInsensitive: (value) => new CaseInsensitive(value),
  count(expression) {
    return new AggregateFunction(`COUNT`, [expression ?? STAR]);
  },
  eq: binaryOperator(OperatorDefinitions.EQ),
  gt: binaryOperator(OperatorDefinitions.GT),
  gte: binaryOperator(OperatorDefinitions.GTE),
  ilike: binaryOperator(OperatorDefinitions.ILIKE),
  like: binaryOperator(OperatorDefinitions.LIKE),
  lower: nonAggregateFunction(`LOWER`),
  lt: binaryOperator(OperatorDefinitions.LT),
  lte: binaryOperator(OperatorDefinitions.LTE),
  max: aggregateFunction(`MAX`),
  min: aggregateFunction(`MIN`),
  neq: binaryOperator(OperatorDefinitions.NEQ),
  not: overload(
    {
      expression(value: Value<boolean>): Value<boolean> {
        if (typeof value === 'boolean') return !value;
        return new OperatorExpression(
          OperatorDefinitions.NOT,
          value,
          valueToSql,
        );
      },
      fieldQuery<T>(value: FieldCondition<T>): FieldCondition<T> {
        if (isSpecialValue(value)) {
          const constantValueOfExpression = fieldConditionToConstant(value);
          const constantValueOfNot =
            constantValueOfExpression !== null
              ? !constantValueOfExpression
              : null;
          return new OperatorFieldQuery(
            OperatorDefinitions.NOT,
            value,
            fieldConditionToSql,
            constantValueOfNot,
          );
        } else {
          return new OperatorFieldQuery(
            OperatorDefinitions.NEQ,
            value,
            prepareBinaryOperatorFieldQuery,
            null,
          );
        }
      },
    },
    (value: any) => {
      return (isSpecialValue(value) && !isComputedFieldQuery(value)) ||
        sql.isSqlQuery(value) ||
        typeof value === 'boolean'
        ? `expression`
        : `fieldQuery`;
    },
  ),
  or: variadicOperator(OperatorDefinitions.OR, (...params) => {
    if (params.some((p) => p === true)) return true;
    if (params.every((p) => p === false)) return false;
    return undefined;
  }),
  sum: aggregateFunction(`SUM`),
};

export default Operators;
