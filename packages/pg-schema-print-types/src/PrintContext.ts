import {relative, dirname} from 'path';
import {Schema, ClassDetails, Type} from '@databases/pg-schema-introspect';
import PrintOptions from './PrintOptions';
import FileName from './FileName';
import TypeID, {DEFAULT_EXPORT_PRIORITY} from './TypeID';
import DefaultTypeScriptMapping from './DefaultTypeScriptMapping';
import IdentifierName from './IdentifierName';

export interface FileContext {
  // asExport: (declaration: string[]) => string[];
  // asNamedExport: (declaration: string[]) => string[];
  // asDefaultExport: (exportName: string) => string[];
  getImport: (fileExport: FileExport) => string;
}
export interface FileExport {
  file: FileName;
  isDefaultExport: () => boolean;
  exportName: string;
}

class ImportState {
  public readonly file: FileName;
  private readonly _namedImports = new Map<string, FileExport>();
  constructor(file: FileName) {
    this.file = file;
  }
  public getImport(fileExport: FileExport): string {
    this._namedImports.set(fileExport.exportName, fileExport);
    return fileExport.exportName;
  }
  public getImportStatement(relativePath: string) {
    const defaultImport = [...this._namedImports.values()].find((v) =>
      v.isDefaultExport(),
    )?.exportName;
    const namedImports = [...this._namedImports.values()]
      .filter((v) => !v.isDefaultExport())
      .map((v) => v.exportName);
    const specifiers: string[] = [];
    if (defaultImport) {
      specifiers.push(defaultImport);
    }
    if (namedImports.length) {
      specifiers.push(`{${namedImports.sort().join(', ')}}`);
    }
    return `import ${specifiers.join(', ')} from '${relativePath}'`;
  }
}

class FileContent {
  public readonly file: FileName;
  private readonly _options: PrintOptions;
  private readonly _imports = new Map<FileName, ImportState>();
  private readonly _declarationNames = new Set<string>();
  private readonly _declarations: (() => string[])[] = [];
  constructor(file: FileName, options: PrintOptions) {
    this.file = file;
    this._options = options;
  }
  private _defaultCandidate: TypeID | undefined;
  private _defaultName: IdentifierName | null | undefined;
  private getDefaultName(): IdentifierName | null {
    if (this._defaultName === undefined) {
      this._defaultName = this._defaultCandidate
        ? this._options.resolveExportName(this._defaultCandidate)
        : null;
    }
    return this._defaultName;
  }

  private _getImportState(
    file: FileName,
  ): {
    getImport: (fileExport: FileExport) => string;
  } {
    if (file === this.file) {
      return {
        getImport: (n) => n.exportName,
      };
    }

    const cachedImportState = this._imports.get(file);
    if (cachedImportState !== undefined) {
      return cachedImportState;
    }

    const newImportState = new ImportState(file);
    this._imports.set(file, newImportState);
    return newImportState;
  }

  public pushDeclaration(
    typeID: TypeID,
    declaration: (identifier: IdentifierName, imp: FileContext) => string[],
  ): FileExport {
    const identifierName = this._options.resolveExportName(typeID);
    if (!this._declarationNames.has(identifierName)) {
      if (
        this._defaultName === undefined &&
        this._options.isDefaultExportCandidate(typeID)
      ) {
        if (this._defaultCandidate === undefined) {
          this._defaultCandidate = typeID;
        } else {
          const oldWeight =
            DEFAULT_EXPORT_PRIORITY[this._defaultCandidate.type];
          const newWeight = DEFAULT_EXPORT_PRIORITY[typeID.type];
          if (oldWeight === newWeight) {
            this._defaultName = null;
          } else if (oldWeight > newWeight) {
            this._defaultCandidate = typeID;
          }
        }
      }
      this._declarationNames.add(identifierName);
      const declarationLines = declaration(identifierName, {
        getImport: (id: FileExport) =>
          this._getImportState(id.file).getImport(id),
      });
      this._declarations.push(() => [
        ...declarationLines,
        this.getDefaultName() === identifierName
          ? `export default ${identifierName};`
          : `export {${identifierName}}`,
      ]);
    }
    return {
      file: this.file,
      isDefaultExport: () => this.getDefaultName() === identifierName,
      exportName: identifierName,
    };
  }

  public getContent() {
    return (
      [
        ...(this._imports.size
          ? [
              [...this._imports.values()]
                .sort((a, b) => (a.file < b.file ? -1 : 1))
                .map((imp) => {
                  const relativePath = relative(dirname(this.file), imp.file);
                  return imp.getImportStatement(
                    `${
                      relativePath[0] === '.' ? '' : './'
                    }${relativePath.replace(/(\.d)?\.tsx?$/, '')}`,
                  );
                })
                .join('\n'),
            ]
          : []),
        ...this._declarations.map((v) => v().join('\n')),
      ].join('\n\n') + '\n'
    );
  }
}

export default class PrintContext {
  private readonly _files = new Map<FileName, FileContent>();
  private readonly _classes: Map<number, ClassDetails>;
  private readonly _types: Map<number, Type>;
  private readonly _overrides: Map<string, string>;

  private readonly _getTypeScriptType: (
    type: Type,
    context: PrintContext,
    file: FileContext,
  ) => string;

  public readonly options: PrintOptions;
  constructor(
    getTypeScriptType: (
      type: Type,
      context: PrintContext,
      file: FileContext,
    ) => string,
    schema: Schema,
    options: PrintOptions,
    overrides: Map<string, string> = new Map(),
  ) {
    this._getTypeScriptType = getTypeScriptType;

    this._classes = new Map(schema.classes.map((c) => [c.classID, c]));
    this._types = new Map(schema.types.map((t) => [t.typeID, t]));

    this.options = options;

    this._overrides = overrides;
  }

  public getClass(id: number) {
    return this._classes.get(id);
  }

  private _getTypeOverride(type: Type): string | null {
    return (
      this._overrides.get(`${type.schemaName}.${type.typeName}`) ??
      this._overrides.get(`${type.typeName}`) ??
      null
    );
  }

  public getTypeScriptType(id: number, file: FileContext) {
    const builtin = DefaultTypeScriptMapping.get(id);
    if (builtin) return builtin;
    const type = this._types.get(id);
    if (!type) return 'string';
    return (
      this._getTypeOverride(type) ?? this._getTypeScriptType(type, this, file)
    );
  }

  public pushDeclaration(
    fileID: TypeID,
    declaration: (identifier: IdentifierName, imp: FileContext) => string[],
  ): FileExport {
    const file = this.options.resolveFilename(fileID);
    const fileContent = mapGetOrSet(
      this._files,
      file,
      () => new FileContent(file, this.options),
    );
    return fileContent.pushDeclaration(fileID, declaration);
  }

  public getFiles() {
    return [...this._files.values()].map((file) => ({
      filename: file.file,
      content: file.getContent(),
    }));
  }
}

function mapSetAndReturn<TKey, TValue>(
  map: {
    set(key: TKey, value: TValue): unknown;
  },
  key: TKey,
  value: TValue,
) {
  map.set(key, value);
  return value;
}

function mapGetOrSet<TKey, TValue>(
  map: {
    get(key: TKey): TValue | undefined;
    set(key: TKey, value: TValue): unknown;
  },
  key: TKey,
  value: () => TValue,
) {
  const cached = map.get(key);
  if (cached !== undefined) return cached;
  return mapSetAndReturn(map, key, value());
}
