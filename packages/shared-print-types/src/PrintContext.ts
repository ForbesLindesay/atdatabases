import {relative, dirname} from 'path';
import PrintOptions, {
  isDefaultExportCandidate,
  resolveExportName,
  resolveFilename,
  resolveFilenameTemplate,
} from './PrintOptions';
import FileName from './FileName';
import IdentifierName from './IdentifierName';

export interface FileContext {
  // asExport: (declaration: string[]) => string[];
  // asNamedExport: (declaration: string[]) => string[];
  // asDefaultExport: (exportName: string) => string[];
  getImport: (fileExport: FileExport) => string;
}
export interface FileExport {
  mode: 'type' | 'value';
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

class FileContent<TypeID> {
  public readonly file: FileName;
  private readonly _options: PrintOptions<TypeID>;
  private readonly _imports = new Map<FileName, ImportState>();
  private readonly _declarationNames = new Set<string>();
  private readonly _declarations: (() => string[])[] = [];
  constructor(file: FileName, options: PrintOptions<TypeID>) {
    this.file = file;
    this._options = options;
  }
  private _defaultCandidate: TypeID | undefined;
  private _defaultName: IdentifierName | null | undefined;
  private getDefaultName(): IdentifierName | null {
    if (this._defaultName === undefined) {
      this._defaultName = this._defaultCandidate
        ? resolveExportName(this._defaultCandidate, this._options)
        : null;
    }
    return this._defaultName;
  }

  private _getImportState(file: FileName): {
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
    mode: 'type' | 'value',
    declaration: (identifier: IdentifierName, imp: FileContext) => string[],
  ): FileExport {
    const identifierName = resolveExportName(typeID, this._options);
    if (!this._declarationNames.has(identifierName)) {
      if (
        this._defaultName === undefined &&
        isDefaultExportCandidate(typeID, this._options)
      ) {
        if (this._defaultCandidate === undefined) {
          this._defaultCandidate = typeID;
        } else {
          const oldWeight = this._options.getExportPriority(
            this._defaultCandidate,
          );
          const newWeight = this._options.getExportPriority(typeID);
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
          : `export ${mode === 'type' ? 'type ' : ''}{${identifierName}}`,
      ]);
    }
    return {
      mode,
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

export default class PrintContext<TypeID> {
  private readonly _files = new Map<FileName, FileContent<TypeID>>();

  public readonly options: PrintOptions<TypeID>;
  constructor(options: PrintOptions<TypeID>) {
    this.options = options;
  }

  private _pushDeclaration(
    id: TypeID,
    mode: 'type' | 'value',
    declaration: (identifier: IdentifierName, imp: FileContext) => string[],
  ): FileExport {
    const file = resolveFilename(id, this.options);
    const fileContent = mapGetOrSet(
      this._files,
      file,
      () => new FileContent(file, this.options),
    );
    return fileContent.pushDeclaration(id, mode, declaration);
  }

  public pushTypeDeclaration(
    id: TypeID,
    declaration: (identifier: IdentifierName, imp: FileContext) => string[],
  ): FileExport {
    return this._pushDeclaration(id, 'type', declaration);
  }
  public pushReExport(id: TypeID, from: FileExport): void {
    const destName = resolveExportName(id, this.options);
    const destFile = resolveFilename(id, this.options);
    if (destFile === from.file && destName === from.exportName) {
      return;
    }
    this._pushDeclaration(id, from.mode, (identifier, file) => {
      const sourceName = file.getImport(from);
      return sourceName === destName
        ? []
        : [
            `${
              from.mode === 'type' ? `type` : `const`
            } ${identifier} = ${sourceName}`,
          ];
    });
  }

  public pushValueDeclaration(
    id: TypeID,
    declaration: (identifier: IdentifierName, imp: FileContext) => string[],
  ): FileExport {
    return this._pushDeclaration(id, 'value', declaration);
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
