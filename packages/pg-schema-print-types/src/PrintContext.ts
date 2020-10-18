import {relative} from 'path';
import {Schema, ClassDetails, Type} from '@databases/pg-schema-introspect';
import PrintOptions from './PrintOptions';
import {FileID, FileName} from './FileName';
import DefaultTypeScriptMapping from './DefaultTypeScriptMapping';

export interface FileContext {
  isDefaultExport: boolean;
  getImport: (fileExport: FileExport) => string;
}
export interface FileExport {
  file: FileName;
  isDefaultExport: boolean;
  exportName: string;
}

class ImportState {
  public readonly file: FileName;
  private readonly _namedImports = new Set<string>();
  private _defaultName: string | null = null;
  constructor(file: FileName) {
    this.file = file;
  }
  public getImport(fileExport: FileExport): string {
    if (fileExport.isDefaultExport) {
      this._defaultName = fileExport.exportName;
    } else {
      this._namedImports.add(fileExport.exportName);
    }
    return fileExport.exportName;
  }
  public getImportStatement(relativePath: string) {
    const specifiers: string[] = [];
    if (this._defaultName) {
      specifiers.push(this._defaultName);
    }
    if (this._namedImports.size) {
      specifiers.push(`{${[...this._namedImports].join(', ')}}`);
    }
    return `import ${specifiers.join(', ')} from '${relativePath}'`;
  }
}

class FileContent {
  public readonly file: FileName;
  private readonly _imports = new Map<FileName, ImportState>();
  private readonly _declarations = new Map<string, string[]>();
  constructor(file: FileName) {
    this.file = file;
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
    exportName: string,
    isDefaultExport: boolean,
    declaration: (imp: FileContext) => string[],
  ) {
    if (!this._declarations.has(exportName)) {
      this._declarations.set(
        exportName,
        declaration({
          isDefaultExport,
          getImport: (id: FileExport) =>
            this._getImportState(id.file).getImport(id),
        }),
      );
    }
    return this;
  }

  public getContent() {
    return (
      [
        ...(this._imports.size
          ? [
              [...this._imports.values()]
                .map((imp) =>
                  imp.getImportStatement(
                    relative(this.file, imp.file).replace(/(\.d)?\.tsx?$/, ''),
                  ),
                )
                .join('\n'),
            ]
          : []),
        ...[...this._declarations.values()].map((v) => v.join('\n')),
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
    fileID: FileID,
    exportName: string,
    declaration: (imp: FileContext) => string[],
  ): FileExport {
    const file = this.options.resolveFilename(fileID);
    const isDefaultExport = file.includes(exportName);
    this._files.set(
      file,
      (this._files.get(file) || new FileContent(file)).pushDeclaration(
        exportName,
        isDefaultExport,
        declaration,
      ),
    );
    return {file, isDefaultExport, exportName};
  }

  public getFiles() {
    return [...this._files.values()].map((file) => ({
      filename: file.file,
      content: file.getContent(),
    }));
  }
}
