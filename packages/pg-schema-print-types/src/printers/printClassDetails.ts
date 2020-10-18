import {
  ClassDetails,
  Attribute,
  ConstraintType,
} from '@databases/pg-schema-introspect';
import PrintContext, {FileContext} from '../PrintContext';

export enum PrimaryKeyMode {
  StrictBrand,
  LooseBrand,
  InlineStrictBrand,
  InlineLooseBrand,
  InlineNoBrand,
}

export default function printClassDetails(
  type: ClassDetails,
  context: PrintContext,
) {
  const DatabaseRecord = context.pushDeclaration(
    {type: 'class', name: type.className},
    `${type.className}_DatabaseRecord`,
    (file) => [
      `export ${file.isDefaultExport ? `default ` : ``}interface ${
        type.className
      }_DatabaseRecord {`,
      ...type.attributes.map(
        (attribute) =>
          `  ${attribute.attributeName}: ${getAttributeType(
            type,
            attribute,
            context,
            file,
          )}`,
      ),
      `}`,
    ],
  );
  const InsertParameters = context.pushDeclaration(
    {type: 'class', name: type.className},
    `${type.className}_InsertParameters`,
    (file) => [
      `export ${file.isDefaultExport ? `default ` : ``}interface ${
        type.className
      }_InsertParameters {`,
      ...type.attributes.map(
        (attribute) =>
          `  ${attribute.attributeName}${optionalOnInsert(
            attribute,
          )}: ${getAttributeType(type, attribute, context, file)}`,
      ),
      `}`,
    ],
  );
  return {DatabaseRecord, InsertParameters};
}

function getAttributeType(
  type: ClassDetails,
  attribute: Attribute,
  context: PrintContext,
  file: FileContext,
): string {
  if (!attribute.notNull) {
    return `${getAttributeType(
      type,
      {...attribute, notNull: true},
      context,
      file,
    )} | null`;
  }

  for (const constraint of type.constraints) {
    if (constraint.tableAttributeNumbers.includes(attribute.attributeNumber)) {
      if (
        constraint.constraintType === ConstraintType.ForeignKey &&
        constraint.referencedClassID !== type.classID
      ) {
        const referencedClass = context.getClass(constraint.referencedClassID);
        if (referencedClass) {
          const referencedAttributeNumber =
            constraint.referencedAttributeNumbers[
              constraint.tableAttributeNumbers.indexOf(
                attribute.attributeNumber,
              )
            ];
          const referencedAttribute = referencedClass.attributes.find(
            (a) => a.attributeNumber === referencedAttributeNumber,
          );
          if (referencedAttribute) {
            const {DatabaseRecord} = printClassDetails(
              referencedClass,
              context,
            );
            return `${file.getImport(DatabaseRecord)}['${
              referencedAttribute.attributeName
            }']`;
          }
        }
      } else if (constraint.constraintType === ConstraintType.PrimaryKey) {
        return handleBrand(
          context.options.primaryKeyMode,
          type.className,
          attribute,
          context,
          file,
        );
      }
    }
  }
  return context.getTypeScriptType(attribute.typeID, file);
}

function optionalOnInsert(attribute: Attribute): string {
  if (!attribute.notNull) return '?';
  if (attribute.hasDefault) return '?';
  return '';
}

function handleBrand(
  mode: PrimaryKeyMode,
  className: string,
  attribute: Attribute,
  context: PrintContext,
  file: FileContext,
): string {
  switch (mode) {
    case PrimaryKeyMode.StrictBrand:
    case PrimaryKeyMode.LooseBrand:
      return file.getImport(
        context.pushDeclaration(
          {type: 'class', name: className},
          `${className}_${attribute.attributeName}`,
          ({isDefaultExport}) => [
            `${isDefaultExport ? `` : `export `}type ${className}_${
              attribute.attributeName
            } = ${context.getTypeScriptType(
              attribute.typeID,
              file,
            )} & ${getBrand(mode, className, attribute)}`,
          ],
        ),
      );
    case PrimaryKeyMode.InlineLooseBrand:
    case PrimaryKeyMode.InlineStrictBrand:
      return `${context.getTypeScriptType(attribute.typeID, file)} & ${getBrand(
        mode,
        className,
        attribute,
      )}`;
    case PrimaryKeyMode.InlineNoBrand:
      return context.getTypeScriptType(attribute.typeID, file);
  }
}

function getBrand(
  mode:
    | PrimaryKeyMode.InlineLooseBrand
    | PrimaryKeyMode.LooseBrand
    | PrimaryKeyMode.InlineStrictBrand
    | PrimaryKeyMode.StrictBrand,
  className: string,
  attribute: Attribute,
): string {
  switch (mode) {
    case PrimaryKeyMode.InlineLooseBrand:
    case PrimaryKeyMode.LooseBrand:
      return `{readonly __brand?: '${className}_${attribute.attributeName}'}`;
    case PrimaryKeyMode.InlineStrictBrand:
    case PrimaryKeyMode.StrictBrand:
      return `{readonly __brand: '${className}_${attribute.attributeName}'}`;
  }
}
// export enum PrimaryKeyMode {
//   StrictBrand,
//   LooseBrand,
//   InlineStrictBrand,
//   InlineLooseBrand,
//   InlineNoBrand,
// }
