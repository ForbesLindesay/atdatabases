import PgConfig, {DEFAULT_CONFIG} from '@databases/pg-config';
import camelcase = require('camelcase');
import pascalcase = require('uppercamelcase');
import {plural, singular} from 'pluralize';
import FileName from './FileName';
import TypeID from './TypeID';
import IdentifierName from './IdentifierName';

function parseTemplate(str: string) {
  const variables = [];
  const result: ((values: any) => string)[] = [];
  let inVariables = false;
  for (const part of str.split('{{')) {
    if (inVariables) {
      const split = part.split('}}');
      if (split.length !== 2) {
        throw new Error(`Mismatched parentheses: ${str}`);
      }
      const [placeholder, plainString] = split;
      const [variable, ...filters] = placeholder
        .split('|')
        .map((str) => str.trim());
      variables.push(variable);
      result.push((values) => {
        if (!(variable in values)) {
          throw new Error(`Unrecognized variable ${variable} in ${str}`);
        }
        return filters.reduce((value, filter) => {
          switch (filter) {
            case 'pascal-case':
              return pascalcase(value);
            case 'camel-case':
              return camelcase(value);
            case 'plural':
              return plural(value);
            case 'singular':
              return singular(value);
            default:
              throw new Error(
                `Unrecognized filter in type generation config, "${filter}" in: ${str}`,
              );
          }
        }, values[variable]);
      });
      result.push(() => plainString);
    } else {
      inVariables = true;
      result.push(() => part);
    }
  }
  return {
    variables,
    applyTemplate: (value: any) => result.map((r) => r(value)).join(''),
  };
}

function isDefaultExportCandidate(fileTemplate: string, typeTemplate: string) {
  const allowedValues = new Set(parseTemplate(fileTemplate).variables);
  return parseTemplate(typeTemplate).variables.every((v) =>
    allowedValues.has(v),
  );
}

export default class PrintOptions {
  private readonly _config: Partial<PgConfig['types']>;

  constructor(config: Partial<PgConfig['types']>) {
    this._config = config;
  }
  private _v<TKey extends keyof PgConfig['types']>(
    key: Literal<TKey>,
  ): PgConfig['types'][Literal<TKey>] {
    return (this._config as any)[key] ?? DEFAULT_CONFIG.types[key];
  }
  public get domainTypeMode() {
    return this._v('domainTypeMode');
  }
  public get enumTypeMode() {
    return this._v('enumTypeMode');
  }
  public get primaryKeyTypeMode() {
    return this._v('primaryKeyTypeMode');
  }

  public get columnTypeOverrides() {
    return this._v('columnTypeOverrides');
  }
  public get typeOverrides() {
    return this._v('typeOverrides');
  }

  isDefaultExportCandidate(fileID: TypeID): boolean {
    switch (fileID.type) {
      case 'schema':
        return isDefaultExportCandidate(
          this._v('schemaFileName'),
          this._v('schemaTypeName'),
        );
      case 'class':
        return isDefaultExportCandidate(
          this._v('tableFileName'),
          this._v('tableTypeName'),
        );
      case 'insert_parameters':
        return isDefaultExportCandidate(
          this._v('tableInsertParametersFileName'),
          this._v('tableInsertParametersTypeName'),
        );
      case 'primary_key':
        return isDefaultExportCandidate(
          this._v('primaryKeyFileName'),
          this._v('primaryKeyTypeName'),
        );
      case 'enum':
        return isDefaultExportCandidate(
          this._v('enumFileName'),
          this._v('enumTypeName'),
        );
      case 'domain':
        return isDefaultExportCandidate(
          this._v('domainFileName'),
          this._v('domainTypeName'),
        );
      case 'serializeValue':
        return isDefaultExportCandidate(
          this._v('serializeValueFileName'),
          this._v('serializeValueTypeName'),
        );
    }
  }

  resolveExportName(fileID: TypeID): IdentifierName {
    switch (fileID.type) {
      case 'schema':
        return parseTemplate(this._v('schemaTypeName')).applyTemplate({});
      case 'class':
        return parseTemplate(this._v('tableTypeName')).applyTemplate({
          TABLE_NAME: fileID.name,
        });
      case 'insert_parameters':
        return parseTemplate(
          this._v('tableInsertParametersTypeName'),
        ).applyTemplate({
          TABLE_NAME: fileID.name,
        });
      case 'primary_key':
        return parseTemplate(this._v('primaryKeyTypeName')).applyTemplate({
          TABLE_NAME: fileID.name,
          COLUMN_NAME: fileID.columnName,
        });
      case 'enum':
        return parseTemplate(this._v('enumTypeName')).applyTemplate({
          TYPE_NAME: fileID.name,
        });
      case 'domain':
        return parseTemplate(this._v('domainTypeName')).applyTemplate({
          TYPE_NAME: fileID.name,
        });
      case 'serializeValue':
        return parseTemplate(this._v('serializeValueTypeName')).applyTemplate(
          {},
        );
    }
  }

  resolveFilename(fileID: TypeID): FileName {
    switch (fileID.type) {
      case 'schema':
        return parseTemplate(this._v('schemaFileName')).applyTemplate({});
      case 'class':
        return parseTemplate(this._v('tableFileName')).applyTemplate({
          TABLE_NAME: fileID.name,
        });
      case 'insert_parameters':
        return parseTemplate(
          this._v('tableInsertParametersFileName'),
        ).applyTemplate({
          TABLE_NAME: fileID.name,
        });
      case 'primary_key':
        return parseTemplate(this._v('primaryKeyFileName')).applyTemplate({
          TABLE_NAME: fileID.name,
          COLUMN_NAME: fileID.columnName,
        });
      case 'enum':
        return parseTemplate(this._v('enumFileName')).applyTemplate({
          TYPE_NAME: fileID.name,
        });
      case 'domain':
        return parseTemplate(this._v('domainFileName')).applyTemplate({
          TYPE_NAME: fileID.name,
        });
      case 'serializeValue':
        return parseTemplate(this._v('serializeValueFileName')).applyTemplate(
          {},
        );
    }
  }
}

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never;

// We want to ensure that a literal string/enum value is used:
// https://stackoverflow.com/a/56375136/272958
type CheckForUnion<T> = [T] extends [UnionToIntersection<T>] ? unknown : never;

/**
 * Only accept a single type, not a union of types
 */
export type Literal<TValue> = TValue & CheckForUnion<TValue>;
