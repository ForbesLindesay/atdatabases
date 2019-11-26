export enum NodeKind {
  Identifier,
  SelectStatement,
  ResultColumnExpression,
  ResultColumnAll,
  ResultColumnAllInTable,
  LiteralValue,
  NowLiteral,
}
export interface Node {
  range: [number, number];
}
export interface SelectStatement extends Node {
  kind: NodeKind.SelectStatement;
}

export interface Identifier extends Node {
  kind: NodeKind.Identifier;
  value: string;
}

export type ResultColumn =
  | ResultColumnExpression
  | ResultColumnAll
  | ResultColumnAllInTable;
export interface ResultColumnExpression extends Node {
  kind: NodeKind.ResultColumnExpression;
}
export interface ResultColumnAll extends Node {
  kind: NodeKind.ResultColumnAll;
}
export interface ResultColumnAllInTable extends Node {
  kind: NodeKind.ResultColumnAllInTable;
  tableName: Identifier;
}

export interface LiteralValue extends Node {
  kind: NodeKind.LiteralValue;
  value: string | number | boolean | null;
}
export interface NowLiteral extends Node {
  kind: NodeKind.NowLiteral;
  value: 'current_time' | 'current_date' | 'current_timestamp';
}
