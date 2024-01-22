import {PrintOptions} from '@databases/shared-print-types';
import MySqlConfig, {DEFAULT_CONFIG} from '@databases/mysql-config';
import TypeID from './TypeID';
import {Schema, TableDetails} from '@databases/mysql-schema-introspect';

export default class MySqlPrintOptions implements PrintOptions<TypeID> {
  private readonly _config: Partial<MySqlConfig['types']>;
  private readonly _tables: Map<string, TableDetails>;
  constructor(config: Partial<MySqlConfig['types']>, schema: Schema) {
    this._config = config;
    this._tables = new Map(
      schema.tables.map((t) => [`${t.schemaName}.${t.tableName}`, t]),
    );
  }
  private _v<TKey extends keyof MySqlConfig['types']>(
    key: Literal<TKey>,
  ): MySqlConfig['types'][Literal<TKey>] {
    return (this._config as any)[key] ?? DEFAULT_CONFIG.types[key];
  }

  getTable(key: {schemaName: string; tableName: string}): TableDetails | null {
    return this._tables.get(`${key.schemaName}.${key.tableName}`) ?? null;
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
      case 'table':
        return 1;
      case 'insert_parameters':
      case 'primary_key':
        return 2;
      case 'serializeValue':
        return 3;
    }
  }
  getExportNameTemplate(id: TypeID): string {
    switch (id.type) {
      case 'schema':
        return this._v('schemaTypeName');
      case 'table':
        return this._v('tableTypeName');
      case 'insert_parameters':
        return this._v('tableInsertParametersTypeName');
      case 'primary_key':
        return this._v('primaryKeyTypeName');
      case 'serializeValue':
        return this._v('serializeValueTypeName');
    }
  }
  getFilenameTemplate(id: TypeID): string {
    switch (id.type) {
      case 'schema':
        return this._v('schemaFileName');
      case 'table':
        return this._v('tableFileName');
      case 'insert_parameters':
        return this._v('tableInsertParametersFileName');
      case 'primary_key':
        return this._v('primaryKeyFileName');
      case 'serializeValue':
        return this._v('serializeValueFileName');
    }
  }
  getTemplateValues(id: TypeID) {
    switch (id.type) {
      case 'schema':
      case 'serializeValue':
        return {};
      case 'table':
      case 'insert_parameters':
        return {TABLE_NAME: id.name};
      case 'primary_key':
        return {
          TABLE_NAME: id.name,
          COLUMN_NAME: id.columnName,
        };
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
