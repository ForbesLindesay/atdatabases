import {SQLQuery, sql} from '@databases/pg';
import {
  AggregatedTypedValue,
  AnyOf,
  ComputedFieldCondition,
  FieldCondition,
  FieldConditionToSqlContext,
  isAnyOfCondition,
  isComputedFieldQuery,
  isSpecialValue,
  NonAggregatedValue,
  RawValue,
  TypedValue,
  UnknownValue,
  Value,
  ValueToSqlContext,
} from '../types/SpecialValues';
import {
  BinaryInput,
  OperatorDefinition,
  OperatorDefinitions,
} from '../PostgresOperators';
import {
  AggregatedJsonValue,
  IOperators,
  List,
  NonAggregatedJsonValue,
} from '../types/Operators';
import {ColumnReference} from '../types/Columns';
import WhereCondition from '../WhereCondition';

export function columnReference<T>(
  tableName: string,
  columnName: string,
  isAlias: boolean,
  sqlType: string | null,
): NonAggregatedValue<T> {
  return new ColumnReferenceImplementation(
    tableName,
    columnName,
    isAlias,
    sqlType,
  );
}

export function fieldConditionToPredicateValue<T>(
  column: ColumnReference<T>,
  f: FieldCondition<T>,
): NonAggregatedValue<boolean> {
  const constantValue = fieldConditionToConstant(f);
  if (constantValue !== null) return constantValue;
  return new FieldConditionValue(column, f);
}

export function valueToSelect<T>(
  alias: string,
  value: UnknownValue<T>,
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
  value: NonAggregatedValue<T>,
): NonAggregatedValue<T> {
  if (!isSpecialValue(value)) {
    return value;
  }
  return new AliasTableInValue(tableName, tableAlias, value);
}

export function valueToSql<T>(
  value: UnknownValue<T>,
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

abstract class BaseExpression<T> implements TypedValue<T> {
  public readonly __isSpecialValue = true;
  public readonly __isAggregatedValue = true;
  public readonly __isNonAggregatedComputedValue = true;
  public readonly sqlType: string | null | undefined;
  constructor(sqlType: string | null | undefined) {
    this.sqlType = sqlType;
  }
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

  // This property is assigned in the base class
  public readonly sqlType!: string | null;

  constructor(
    tableName: string,
    columnName: string,
    isAlias: boolean,
    sqlType: string | null,
  ) {
    super(sqlType);
    this.tableName = tableName;
    this.columnName = columnName;
    this.isAlias = isAlias;
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
      this.sqlType,
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

  private readonly _prepareInput: (
    input: TInput,
    ctx: ValueToSqlContext,
  ) => TPreparedInput;

  constructor(
    op: OperatorDefinition<TPreparedInput>,
    input: TInput,
    prepareInput: (input: TInput, ctx: ValueToSqlContext) => TPreparedInput,
    sqlType: string | null | undefined,
  ) {
    super(sqlType);
    this.op = op;
    this.input = input;
    this._prepareInput = prepareInput;
  }

  public toSql(ctx: ValueToSqlContext): SQLQuery {
    return this.op.toSql(
      this._prepareInput(this.input, {
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
  public readonly values: UnknownValue<T>[];
  constructor(
    fn: keyof typeof NON_AGGREGATE_FUNCTIONS,
    values: UnknownValue<T>[],
    sqlType: string | null | undefined,
  ) {
    super(sqlType);
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
  public readonly values: NonAggregatedValue<TArg>[];
  public readonly typeCast: SQLQuery | undefined;
  public readonly condition: undefined | NonAggregatedValue<boolean>;
  public readonly orderByClauses: {
    direction: keyof typeof ORDER_BY_DIRECTION;
    value: NonAggregatedValue<any>;
  }[];
  public readonly isDistinct: boolean;
  constructor(
    fn: keyof typeof AGGREGATE_FUNCTIONS,
    values: NonAggregatedValue<TArg>[],
    sqlType: string | null | undefined,
    typeCast?: SQLQuery,
    condition?: NonAggregatedValue<boolean>,
    orderBy?: NonAggregatedValue<any>[],
    distinct?: boolean,
  ) {
    super(sqlType);
    this.fn = fn;
    this.values = values;
    this.typeCast = typeCast;
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
    let result = sql`${fn}(${args})`;
    if (this.condition) {
      result = sql`${result} FILTER (WHERE ${valueToSql(this.condition, ctx)})`;
    }
    if (this.typeCast) {
      result = sql`(${result})::${this.typeCast}`;
    }
    return result;
  }

  public distinct(): AggregatedTypedValue<TResult> {
    return new AggregateFunction(
      this.fn,
      this.values,
      this.sqlType,
      this.typeCast,
      this.condition,
      this.orderByClauses,
      true,
    );
  }

  public orderByAsc<TOrderBy>(
    value: NonAggregatedValue<TOrderBy>,
  ): AggregatedTypedValue<TResult> {
    return new AggregateFunction(
      this.fn,
      this.values,
      this.sqlType,
      this.typeCast,
      this.condition,
      [...this.orderByClauses, {direction: 'ASC', value}],
      this.isDistinct,
    );
  }

  public orderByDesc<TOrderBy>(
    value: NonAggregatedValue<TOrderBy>,
  ): AggregatedTypedValue<TResult> {
    return new AggregateFunction(
      this.fn,
      this.values,
      this.sqlType,
      this.typeCast,
      this.condition,
      [...this.orderByClauses, {direction: 'DESC', value}],
      this.isDistinct,
    );
  }

  public filter(
    condition: NonAggregatedValue<boolean>,
  ): AggregatedTypedValue<TResult> {
    return new AggregateFunction(
      this.fn,
      this.values,
      this.sqlType,
      this.typeCast,
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
  public readonly values: NonAggregatedValue<List<FieldCondition<T>>>;
  constructor(values: NonAggregatedValue<List<FieldCondition<T>>>) {
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
  public readonly left: UnknownValue<T>;
  public readonly right: AnyOf<T>;

  constructor(left: UnknownValue<T>, right: AnyOf<T>) {
    super(`BOOLEAN`);
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

function prepareUnaryOperatorExpression<TLeft>(
  expression: UnknownValue<TLeft>,
  ctx: ValueToSqlContext,
): SQLQuery {
  return valueToSql(expression, ctx);
}

function prepareBinaryOperatorExpression<TLeft, TRight>(
  {
    left,
    right,
  }: {
    left: UnknownValue<TLeft>;
    right: UnknownValue<TRight>;
  },
  ctx: ValueToSqlContext,
): BinaryInput {
  const leftSqlType = isSpecialValue(left) ? left.sqlType : null;
  const rightSqlType = isSpecialValue(right) ? right.sqlType : null;

  const ctxWithType = setSqlType(
    ctx,
    leftSqlType === rightSqlType || rightSqlType === null
      ? leftSqlType
      : leftSqlType === null
      ? rightSqlType
      : undefined,
  );
  return {
    left: valueToSql(left, ctxWithType),
    right: valueToSql(right, ctxWithType),
  };
}

function prepareUnaryOperatorFieldQuery(
  _input: null,
  ctx: FieldConditionToSqlContext,
): SQLQuery {
  return ctx.left;
}

function prepareBinaryOperatorFieldQuery<TRight>(
  right: RawValue<TRight>,
  ctx: FieldConditionToSqlContext,
): BinaryInput {
  return {left: ctx.left, right: sql.value(ctx.toValue(right))};
}

function binaryOperator(
  operator: OperatorDefinition<{left: SQLQuery; right: SQLQuery}>,
  {
    getType,
    getUnaryOperator,
    handleAnyOf,
  }: {
    getType?: <TLeft, TRight>(
      left: UnknownValue<TLeft>,
      right: UnknownValue<TRight>,
    ) => string | null | undefined;
    getUnaryOperator?: (value: unknown) => null | OperatorDefinition<SQLQuery>;
    handleAnyOf?: <T>(
      left: NonAggregatedValue<T>,
      right: AnyOf<T>,
    ) => NonAggregatedValue<boolean>;
  } = {},
): (leftOrOnly: any, right?: any) => any {
  return <TLeft, TRight, TResult>(
    leftOrOnly: UnknownValue<TLeft> | RawValue<TRight>,
    right?: UnknownValue<TRight> | AnyOf<TRight>,
  ): Value<TResult> | FieldCondition<TLeft> => {
    if (right === undefined) {
      const unaryOperator = getUnaryOperator?.(leftOrOnly);
      if (unaryOperator) {
        return new OperatorFieldQuery<SQLQuery, null, TLeft>(
          unaryOperator,
          null,
          prepareUnaryOperatorFieldQuery,
          null,
        );
      }
      return new OperatorFieldQuery<BinaryInput, RawValue<TRight>, TLeft>(
        operator,
        leftOrOnly as RawValue<TRight>,
        prepareBinaryOperatorFieldQuery,
        null,
      );
    } else if (isAnyOfCondition(right)) {
      if (handleAnyOf) {
        return handleAnyOf<TLeft | TRight>(
          leftOrOnly as NonAggregatedValue<TLeft>,
          right,
        ) as any;
      }
      throw new Error(`"anyOf" cannot be used with this operator.`);
    } else {
      const unaryOperator = getUnaryOperator?.(right);
      if (unaryOperator) {
        return new OperatorExpression<SQLQuery, UnknownValue<TLeft>, TResult>(
          unaryOperator,
          leftOrOnly as UnknownValue<TLeft>,
          prepareUnaryOperatorExpression,
          getType
            ? getType(leftOrOnly as UnknownValue<TLeft>, right)
            : `BOOLEAN`,
        );
      }
      return new OperatorExpression(
        operator,
        {
          left: leftOrOnly as UnknownValue<TLeft>,
          right,
        },
        prepareBinaryOperatorExpression,
        getType ? getType(leftOrOnly as UnknownValue<TLeft>, right) : `BOOLEAN`,
      );
    }
  };
}

function prepareVariadicOperatorInput<TInput>(
  inputs: readonly UnknownValue<TInput>[],
  ctx: ValueToSqlContext,
) {
  return inputs.map((input) => valueToSql(input, ctx));
}

function booleanOperator(
  operatorName: 'AND' | 'OR',
  {
    getConstantValue,
  }: {
    getConstantValue?: (
      ...params: UnknownValue<boolean>[]
    ) => boolean | undefined;
  },
) {
  const operator: OperatorDefinition<SQLQuery[]> =
    OperatorDefinitions[operatorName];
  const fn = (
    ...params: readonly (UnknownValue<boolean> | WhereCondition<unknown>)[]
  ): any => {
    if (
      params.some(
        (p) =>
          typeof p === 'function' ||
          (typeof p === 'object' &&
            p !== null &&
            !isSpecialValue(p) &&
            !sql.isSqlQuery(p)),
      )
    ) {
      return (columns: any) => {
        return fn(
          ...params.map((condition) => {
            if (typeof condition === 'function') return condition(columns);
            if (
              typeof condition === 'object' &&
              condition !== null &&
              !isSpecialValue(condition) &&
              !sql.isSqlQuery(condition)
            ) {
              return Operators.and(
                ...Object.entries(condition).map(([columnName, value]) =>
                  fieldConditionToPredicateValue(columns[columnName], value),
                ),
              );
            }
            return condition;
          }),
        );
      };
    }

    const flatParams: readonly UnknownValue<boolean>[] = (
      params as UnknownValue<boolean>[]
    ).flatMap((p) => {
      if (p instanceof OperatorExpression && p.op === operator) {
        return p.input as UnknownValue<boolean>[];
      }
      return [p];
    });
    const constantValue = getConstantValue && getConstantValue(...flatParams);
    if (constantValue !== undefined) return constantValue;
    if (flatParams.length === 1) {
      return flatParams[0] as Value<boolean>;
    }

    return new OperatorExpression<
      SQLQuery[],
      readonly UnknownValue<boolean>[],
      boolean
    >(operator, flatParams, prepareVariadicOperatorInput, `BOOLEAN`);
  };
  return fn;
}

function sqlTypeFromArgs(args: any[]) {
  return args.reduce<string | null | undefined>((t, arg) => {
    if (t === undefined) return undefined;
    if (isSpecialValue(arg) && (arg as any).sqlType !== null) {
      if (t === null || t === (args as any).sqlType) {
        return (arg as any).sqlType;
      } else {
        return undefined;
      }
    }
    return t;
  }, null);
}
function nonAggregateFunction(
  fn: keyof typeof NON_AGGREGATE_FUNCTIONS,
  sqlType?: string,
) {
  return <TArgs extends any[], TResult>(...args: TArgs): Value<TResult> => {
    return new NonAggregateFunction(
      fn,
      args,
      sqlType === undefined ? sqlTypeFromArgs(args) : sqlType,
    );
  };
}

function aggregateFunction(
  fn: keyof typeof AGGREGATE_FUNCTIONS,
  sqlType?: string,
) {
  return <TArgs extends any[], TResult>(
    ...args: TArgs
  ): AggregatedTypedValue<TResult> => {
    return new AggregateFunction(
      fn,
      args,
      sqlType === undefined ? sqlTypeFromArgs(args) : sqlType,
    );
  };
}

function fieldConditionToSql<T>(
  value: FieldCondition<T>,
  ctx: FieldConditionToSqlContext,
) {
  if (isSpecialValue(value)) return value.toSqlCondition(ctx);
  const v = ctx.toValue(value);
  if (v === null) {
    return OperatorDefinitions.IS_NULL.toSql(ctx.left, ctx);
  }
  return OperatorDefinitions.EQ.toSql(
    {
      left: ctx.left,
      right: sql.value(v),
    },
    ctx,
  );
}

function fieldConditionToConstant<T>(q: FieldCondition<T>): boolean | null {
  if (isSpecialValue(q)) return q.getStaticValue();
  return null;
}

class FieldConditionValue<T> extends BaseExpression<boolean> {
  public readonly left: ColumnReference<T>;
  public readonly right: FieldCondition<T>;
  constructor(left: ColumnReference<T>, right: FieldCondition<T>) {
    super(`BOOLEAN`);
    this.left = left;
    this.right = right;
  }
  public toSql(ctx: ValueToSqlContext): SQLQuery {
    if (this.left.sqlType) {
    }
    return fieldConditionToSql(this.right, {
      ...setSqlType(ctx, this.left.sqlType),
      left: valueToSql(this.left, ctx),
    });
  }
}

class AliasTableInValue<T> extends BaseExpression<T> {
  public readonly tableName: string;
  public readonly tableAlias: string;
  public readonly value: UnknownValue<T>;
  constructor(tableName: string, tableAlias: string, value: UnknownValue<T>) {
    super(isSpecialValue(value) ? value.sqlType : null);
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

// export interface NonAggregatedJsonValue<TValue> {
//   asString(): NonAggregatedValue<string>;
//   asJson(): NonAggregatedValue<TValue>;
//   prop<TKey extends keyof TValue>(
//     key: TKey,
//   ): NonAggregatedJsonValue<TValue[TKey]>;
// }

// export interface AggregatedJsonValue<TValue> {
//   asString(): AggregatedValue<string>;
//   asJson(): AggregatedValue<TValue>;
//   prop<TKey extends keyof TValue>(key: TKey): AggregatedJsonValue<TValue[TKey]>;
// }

class JsonValue<TBaseValue, TValueAtPath>
  implements
    NonAggregatedJsonValue<TValueAtPath>,
    AggregatedJsonValue<TValueAtPath>
{
  readonly __isSpecialValue = true;
  private readonly _value: UnknownValue<TBaseValue>;
  private readonly _path: string[];
  constructor(value: UnknownValue<TBaseValue>, path: string[]) {
    this._value = value;
    this._path = path;
  }
  prop<TKey extends keyof TValueAtPath>(key: TKey) {
    return new JsonValue<TBaseValue, TValueAtPath[TKey]>(this._value, [
      ...this._path,
      `${key as string | number}`,
    ]);
  }
  asString(): Value<string> {
    return new JsonValueResult(this._value, this._path, true, `TEXT`);
  }
  asJson(): Value<TValueAtPath> {
    return new JsonValueResult(
      this._value,
      this._path,
      false,
      isSpecialValue(this._value) ? this._value.sqlType : null,
    );
  }
}

class JsonValueResult<
  TBaseValue,
  TValueAtPath,
> extends BaseExpression<TValueAtPath> {
  private readonly _value: UnknownValue<TBaseValue>;
  private readonly _path: string[];
  private readonly _asText: boolean;
  constructor(
    value: UnknownValue<TBaseValue>,
    path: string[],
    asText: boolean,
    sqlType: string | null | undefined,
  ) {
    super(sqlType);
    this._value = value;
    this._path = path;
    this._asText = asText;
  }
  public toSql(ctx: ValueToSqlContext): SQLQuery {
    if (this._asText) {
      return sql`${valueToSql(this._value, ctx)}#>>${this._path}`;
    } else {
      return sql`${valueToSql(this._value, ctx)}#>${this._path}`;
    }
  }
}

// function prepareExpressionAndType<T>(
//   {expression, type}: {expression: UnknownValue<T>; type: string},
//   ctx: ValueToSqlContext,
// ) {
//   if (!/^[a-z]([a-z0-9_]*[a-z0-9])?(\[\])?$/i.test(type)) {
//     throw new Error(`Invalid type: ${type}`);
//   }
//   return {
//     expression: valueToSql(expression, ctx),
//     type: sql.__dangerous__rawValue(type),
//   };
// }
// function typeCast<TInput, TResult>(
//   expression: UnknownValue<TInput>,
//   sqlType: string,
// ): TypedValue<TResult> {
//   return new OperatorExpression<
//     {expression: SQLQuery; type: SQLQuery},
//     {expression: UnknownValue<TInput>; type: string},
//     TResult
//   >(
//     OperatorDefinitions.TYPECAST,
//     {expression, type: sqlType},
//     prepareExpressionAndType,
//     sqlType,
//   );
// }

function setSqlType(
  ctx: ValueToSqlContext,
  sqlType: string | null | undefined,
): ValueToSqlContext {
  if (sqlType === 'JSON' || sqlType === 'JSONB') {
    return {
      ...ctx,
      toValue: (v) => JSON.stringify(v),
    };
  }
  if (sqlType === 'JSON[]' || sqlType === 'JSONB[]') {
    return {
      ...ctx,
      toValue: (v) =>
        Array.isArray(v) ? v.map((v) => JSON.stringify(v)) : ctx.toValue(v),
    };
  }
  return ctx;
}

const Operators: IOperators = {
  allOf: (values) => new AllOf(values),
  and: booleanOperator(`AND`, {
    getConstantValue: (...params) => {
      if (params.every((p) => p === true)) return true;
      if (params.some((p) => p === false)) return false;
      return undefined;
    },
  }),
  anyOf: (values) => new AnyOfImplementation(values),
  caseInsensitive: (value) => new CaseInsensitive(value),
  count(expression) {
    return new AggregateFunction(
      `COUNT`,
      [expression ?? STAR],
      `INT`,
      sql`INT`,
    );
  },
  eq: binaryOperator(OperatorDefinitions.EQ, {
    getUnaryOperator(right) {
      if (right === null) {
        return OperatorDefinitions.IS_NULL;
      }
      return null;
    },
    handleAnyOf<T>(
      left: NonAggregatedValue<T>,
      right: AnyOf<T>,
    ): NonAggregatedValue<boolean> {
      if (
        right instanceof AnyOfImplementation &&
        !isSpecialValue(right.values) &&
        !sql.isSqlQuery(right.values) &&
        [...right.values].length === 0
      ) {
        return false;
      }
      return new EqualsAnyOf<T>(left, right) as any;
    },
  }),
  gt: binaryOperator(OperatorDefinitions.GT),
  gte: binaryOperator(OperatorDefinitions.GTE),
  ilike: binaryOperator(OperatorDefinitions.ILIKE),
  json: <T>(value: UnknownValue<T>): JsonValue<T, T> => {
    return new JsonValue<T, T>(value, []);
  },
  like: binaryOperator(OperatorDefinitions.LIKE),
  lower: nonAggregateFunction(`LOWER`),
  lt: binaryOperator(OperatorDefinitions.LT),
  lte: binaryOperator(OperatorDefinitions.LTE),
  max: aggregateFunction(`MAX`),
  min: aggregateFunction(`MIN`),
  neq: binaryOperator(OperatorDefinitions.NEQ, {
    getUnaryOperator(right) {
      if (right === null) {
        return OperatorDefinitions.IS_NOT_NULL;
      }
      return null;
    },
  }),
  not: <T>(value: UnknownValue<boolean> | FieldCondition<T>): any => {
    if (typeof value === 'boolean') return !value;

    if (isSpecialValue(value) && isComputedFieldQuery(value)) {
      const constantValueOfExpression = fieldConditionToConstant(value);
      const constantValueOfNot =
        constantValueOfExpression !== null ? !constantValueOfExpression : null;
      return new OperatorFieldQuery<SQLQuery, FieldCondition<T>, T>(
        OperatorDefinitions.NOT,
        value,
        fieldConditionToSql,
        constantValueOfNot,
      );
    }

    if (sql.isSqlQuery(value) || isSpecialValue(value)) {
      return new OperatorExpression<SQLQuery, UnknownValue<boolean>, boolean>(
        OperatorDefinitions.NOT,
        value,
        valueToSql,
        `BOOLEAN`,
      );
    }

    if (value === null) {
      return new OperatorFieldQuery<SQLQuery, null, T>(
        OperatorDefinitions.IS_NOT_NULL,
        null,
        prepareUnaryOperatorFieldQuery,
        null,
      );
    } else {
      return new OperatorFieldQuery<BinaryInput, RawValue<T>, T>(
        OperatorDefinitions.NEQ,
        value,
        prepareBinaryOperatorFieldQuery,
        null,
      );
    }
  },
  or: booleanOperator(`OR`, {
    getConstantValue: (...params) => {
      if (params.some((p) => p === true)) return true;
      if (params.every((p) => p === false)) return false;
      return undefined;
    },
  }),
  sum: aggregateFunction(`SUM`),
  upper: nonAggregateFunction(`UPPER`),
};

export default Operators;
