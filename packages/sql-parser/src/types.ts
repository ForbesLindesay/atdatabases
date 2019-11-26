export enum NodeKind {
  Explain,
  Identifier,
  Statement,
}
export interface Node {
  range: [number, number];
}
export interface Explain extends Node {
  kind: NodeKind.Explain;
  statement: Statement;
}
export interface Statement extends Node {
  kind: NodeKind.Statement;
}

export interface Identifier extends Node {
  kind: NodeKind.Identifier;
  value: string;
}
