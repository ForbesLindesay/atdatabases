import assertNever from 'assert-never';
import {PrintOptions} from '@databases/shared-print-types';
import PgConfig, {DEFAULT_CONFIG} from '@databases/pg-config';
import TypeID from './TypeID';

export default class PgPrintOptions implements PrintOptions<TypeID> {
  private readonly _config: Partial<PgConfig['types']>;
  private readonly _includeTables: ReadonlySet<string> | null;
  private readonly _ignoreTables: ReadonlySet<string>;
  constructor(config: Partial<PgConfig['types']>) {
    this._config = config;
    this._includeTables = config.includeTables
      ? new Set(config.includeTables)
      : null;
    this._ignoreTables = new Set(config.ignoreTables ?? []);
  }

  isTableIgnored(tableName: string): boolean {
    return (
      (this._includeTables !== null && !this._includeTables.has(tableName)) ||
      this._ignoreTables.has(tableName)
    );
  }

  private _v<TKey extends keyof PgConfig['types']>(
    key: Literal<TKey>,
  ): PgConfig['types'][Literal<TKey>] {
    return (this._config as any)[key] ?? DEFAULT_CONFIG.types[key];
  }
  public getSchemaJsonFileName() {
    if (this._config.schemaJsonFileName !== undefined) {
      return this._config.schemaJsonFileName;
    } else {
      return DEFAULT_CONFIG.types.schemaJsonFileName;
    }
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

  getExportPriority(id: TypeID): number {
    switch (id.type) {
      case 'schema':
        return 0;
      case 'class':
        return 2;
      case 'insert_parameters':
      case 'primary_key':
      case 'enum':
      case 'domain':
        return 3;
      case 'serializeValue':
        return 4;
      case 're_export':
        return 5;
    }
  }
  getExportNameTemplate(id: TypeID): string {
    switch (id.type) {
      case 'schema':
        return this._v('schemaTypeName');
      case 'class':
        return this._v('tableTypeName');
      case 'insert_parameters':
        return this._v('tableInsertParametersTypeName');
      case 'primary_key':
        return this._v('primaryKeyTypeName');
      case 'enum':
        return this._v('enumTypeName');
      case 'domain':
        return this._v('domainTypeName');
      case 'serializeValue':
        return this._v('serializeValueTypeName');
      case 're_export':
        return this.getExportNameTemplate(id.of);
    }
  }
  getFilenameTemplate(id: TypeID): string {
    switch (id.type) {
      case 'schema':
        return this._v('schemaFileName');
      case 'class':
        return this._v('tableFileName');
      case 'insert_parameters':
        return this._v('tableInsertParametersFileName');
      case 'primary_key':
        return this._v('primaryKeyFileName');
      case 'enum':
        return this._v('enumFileName');
      case 'domain':
        return this._v('domainFileName');
      case 'serializeValue':
        return this._v('serializeValueFileName');
      case 're_export':
        switch (id.of.type) {
          case 'class': {
            if (this._config.tableReExportFileName === null) {
              return this.getFilenameTemplate(id.of);
            }
            return (
              this._v('tableReExportFileName') ??
              this.getFilenameTemplate(id.of)
            );
          }
          case 'insert_parameters':
            if (this._config.tableInsertParametersReExportFileName === null) {
              return this.getFilenameTemplate(id.of);
            }
            return (
              this._v('tableInsertParametersReExportFileName') ??
              this.getFilenameTemplate(id.of)
            );
          default:
            return assertNever(id.of);
        }
    }
  }
  getTemplateValues(id: TypeID): any {
    switch (id.type) {
      case 'schema':
      case 'serializeValue':
        return {};
      case 'class':
      case 'insert_parameters':
        return {TABLE_NAME: id.name};
      case 'primary_key':
        return {
          TABLE_NAME: id.name,
          COLUMN_NAME: id.columnName,
        };
      case 'enum':
      case 'domain':
        return {TYPE_NAME: id.name};
      case 're_export':
        return this.getTemplateValues(id.of);
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
