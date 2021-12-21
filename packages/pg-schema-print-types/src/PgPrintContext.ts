import {Schema, ClassDetails, Type} from '@databases/pg-schema-introspect';
import {FileContext, PrintContext} from '@databases/shared-print-types';
import PgPrintOptions from './PgPrintOptions';
import TypeID from './TypeID';
import DefaultTypeScriptMapping from './DefaultTypeScriptMapping';
import PgDataTypeID from '@databases/pg-data-type-id';

export default class PgPrintContext {
  private readonly _classes: Map<number, ClassDetails>;
  private readonly _types: Map<number, Type>;

  private readonly _getTypeScriptType: (
    type: Type,
    context: PgPrintContext,
    file: FileContext,
  ) => string;

  public readonly printer: PrintContext<TypeID>;
  public readonly options: PgPrintOptions;
  constructor(
    getTypeScriptType: (
      type: Type,
      context: PgPrintContext,
      file: FileContext,
    ) => string,
    schema: Schema,
    options: PgPrintOptions,
  ) {
    this.printer = new PrintContext(options);
    this.options = options;

    this._getTypeScriptType = getTypeScriptType;

    this._classes = new Map(schema.classes.map((c) => [c.classID, c]));
    this._types = new Map(schema.types.map((t) => [t.typeID, t]));
  }

  public getClass(id: number) {
    return this._classes.get(id);
  }

  private _getTypeOverride(type: Type): string | null {
    return (
      this.options.typeOverrides[`${type.schemaName}.${type.typeName}`] ??
      this.options.typeOverrides[`${type.typeName}`] ??
      null
    );
  }

  public getTypeScriptType(id: number, file: FileContext): string {
    const override = this.options.typeOverrides[id];
    if (override !== undefined) {
      return override;
    }
    if (id in PgDataTypeID) {
      const str = PgDataTypeID[id];
      const override = this.options.typeOverrides[str];
      if (override !== undefined) {
        return override;
      }
    }
    const builtin = DefaultTypeScriptMapping.get(id);
    if (builtin) return builtin;
    const type = this._types.get(id);
    if (!type) return 'string';
    return (
      this._getTypeOverride(type) ?? this._getTypeScriptType(type, this, file)
    );
  }
}
