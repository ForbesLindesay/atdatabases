import PgConfig from '@databases/pg-config';
import camelcase = require('camelcase');
import pascalcase = require('uppercamelcase');
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
  private readonly _config: PgConfig['types'];

  constructor(config: PgConfig['types']) {
    this._config = config;
  }
  public get directory() {
    return this._config.directory;
  }
  public get domainTypeMode() {
    return this._config.domainTypeMode;
  }
  public get enumTypeMode() {
    return this._config.enumTypeMode;
  }
  public get primaryKeyTypeMode() {
    return this._config.primaryKeyTypeMode;
  }

  public get columnTypeOverrides() {
    return this._config.columnTypeOverrides;
  }
  public get typeOverrides() {
    return this._config.typeOverrides;
  }

  isDefaultExportCandidate(fileID: TypeID): boolean {
    switch (fileID.type) {
      case 'schema':
        return isDefaultExportCandidate(
          this._config.schemaFileName,
          this._config.schemaTypeName,
        );
      case 'class':
        return isDefaultExportCandidate(
          this._config.tableFileName,
          this._config.tableTypeName,
        );
      case 'insert_parameters':
        return isDefaultExportCandidate(
          this._config.tableInsertParametersFileName,
          this._config.tableInsertParametersTypeName,
        );
      case 'primary_key':
        return isDefaultExportCandidate(
          this._config.primaryKeyFileName,
          this._config.primaryKeyTypeName,
        );
      case 'enum':
        return isDefaultExportCandidate(
          this._config.enumFileName,
          this._config.enumTypeName,
        );
      case 'domain':
        return isDefaultExportCandidate(
          this._config.domainFileName,
          this._config.domainTypeName,
        );
    }
  }

  resolveExportName(fileID: TypeID): IdentifierName {
    switch (fileID.type) {
      case 'schema':
        return parseTemplate(this._config.schemaTypeName).applyTemplate({});
      case 'class':
        return parseTemplate(this._config.tableTypeName).applyTemplate({
          TABLE_NAME: fileID.name,
        });
      case 'insert_parameters':
        return parseTemplate(
          this._config.tableInsertParametersTypeName,
        ).applyTemplate({
          TABLE_NAME: fileID.name,
        });
      case 'primary_key':
        return parseTemplate(this._config.primaryKeyTypeName).applyTemplate({
          TABLE_NAME: fileID.name,
          COLUMN_NAME: fileID.columnName,
        });
      case 'enum':
        return parseTemplate(this._config.enumTypeName).applyTemplate({
          TYPE_NAME: fileID.name,
        });
      case 'domain':
        return parseTemplate(this._config.domainTypeName).applyTemplate({
          TYPE_NAME: fileID.name,
        });
    }
  }

  resolveFilename(fileID: TypeID): FileName {
    switch (fileID.type) {
      case 'schema':
        return parseTemplate(this._config.schemaFileName).applyTemplate({});
      case 'class':
        return parseTemplate(this._config.tableFileName).applyTemplate({
          TABLE_NAME: fileID.name,
        });
      case 'insert_parameters':
        return parseTemplate(
          this._config.tableInsertParametersFileName,
        ).applyTemplate({
          TABLE_NAME: fileID.name,
        });
      case 'primary_key':
        return parseTemplate(this._config.primaryKeyFileName).applyTemplate({
          TABLE_NAME: fileID.name,
          COLUMN_NAME: fileID.columnName,
        });
      case 'enum':
        return parseTemplate(this._config.enumFileName).applyTemplate({
          TYPE_NAME: fileID.name,
        });
      case 'domain':
        return parseTemplate(this._config.domainFileName).applyTemplate({
          TYPE_NAME: fileID.name,
        });
    }
  }
}

// export interface TypesConfig {
//   /**
//    * What should be generated for custom types with constraints?
//    *
//    * @default "loose_brand"
//    */
//   domainTypeMode: 'strict_brand' | 'loose_brand' | 'alias' | 'inline';
//   /**
//    * What should custom types be called (ignored for domainTypeMode="inline")
//    *
//    * @default "{{ NAME }}"
//    */
//   domainTypeName: string;
//   /**
//    * Where should generated types for domains be put (ignored for domainTypeMode="inline")
//    *
//    * @default "_custom_types.ts"
//    */
//   domainFileName: string;

//   /**
//    * How should Postgres enums be represented in TypeScript?
//    *
//    * @default "union_alias"
//    */
//   enumTypeMode: 'enum' | 'union_alias' | 'union_alias_with_object' | 'inline';
//   /**
//    * What should enums be called (ignored for enumTypeMode="inline")
//    *
//    * @default "{{ NAME }}"
//    */
//   enumTypeName: string;
//   /**
//    * Where should generated types for enums be put (ignored for enumTypeMode="inline")
//    *
//    * @default "_enums.ts"
//    */
//   enumFileName: string;

//   /**
//    * Do you want to use branded types for primary keys?
//    *
//    * @default "inline_loose_brand"
//    */
//   primaryKeyTypeMode:
//     | 'strict_brand'
//     | 'loose_brand'
//     | 'inline_strict_brand'
//     | 'inline_loose_brand'
//     | 'inline_no_brand';
//   /**
//    * What should types for primary keys be called (ignored for primaryKeyMode="inline_*")
//    *
//    * @default "{{ TABLE_NAME }}_{{ COLUMN_NAME }}"
//    */
//   primaryKeyTypeName: string;
//   /**
//    * Where should generated types for primary keys be put (ignored for primaryKeyMode="inline")
//    *
//    * @default "{{ TABLE_NAME }}.ts"
//    */
//   primaryKeyFileName: string;

//   /**
//    * What should TypeScript types for table records be called
//    *
//    * @default "{{ TABLE_NAME }}"
//    */
//   tableTypeName: string;
//   /**
//    * What filename do you want to use for tables
//    *
//    * @default "{{ TABLE_NAME }}.ts"
//    */
//   tableFileName: string;

//   /**
//    * What should TypeScript types for table insert parameters be called
//    *
//    * @default "{{ TABLE_NAME }}_InsertParameters"
//    */
//   tableInsertParametersTypeName: string;
//   /**
//    * What filename do you want to use for tables insert parameters
//    *
//    * @default "{{ TABLE_NAME }}.ts"
//    */
//   tableInsertParametersFileName: string;
