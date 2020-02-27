import SQLQuery from './SQLQuery';

/**
 * The interface we actually expect people to use.
 */
export default interface SQL {
  (strings: TemplateStringsArray, ...values: Array<any>): SQLQuery;

  // tslint:disable:unified-signatures
  /**
   * Joins multiple queries together and puts a separator in between if a
   * separator was defined.
   */
  join(queries: Array<SQLQuery>, separator?: SQLQuery): SQLQuery;
  /**
   * Joins multiple queries together and puts a separator in between if a
   * separator was defined.
   */
  join(
    queries: Array<SQLQuery>,
    separator: ',' | ', ' | ' AND ' | ' OR ',
  ): SQLQuery;
  /**
   * Joins multiple queries together and puts a separator in between if a
   * separator was defined.
   *
   * @deprecated please do not pass the separator as a string, use sql`` to mark it as an SQL string
   */
  join(queries: Array<SQLQuery>, separator: string): SQLQuery;
  // tslint:enable:unified-signatures
  __dangerous__rawValue(text: string): SQLQuery;
  value(value: any): SQLQuery;
  ident(...names: Array<any>): SQLQuery;
  registerFormatter<T>(
    constructor: new (...args: any[]) => T,
    format: (value: T) => SQLQuery,
  ): void;
}
