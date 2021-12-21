import {
  ClassDetails,
  Attribute,
  ConstraintType,
  ClassKind,
} from '@databases/pg-schema-introspect';
import {FileContext} from '@databases/shared-print-types';
import PgPrintContext from '../PgPrintContext';

export default function printClassDetails(
  type: ClassDetails,
  context: PgPrintContext,
) {
  if (type.kind !== ClassKind.OrdinaryTable) {
    throw new Error(
      'printClassDetails only supports ordinary tables at the moment.',
    );
  }
  const DatabaseRecord = context.printer.pushTypeDeclaration(
    {type: 'class', name: type.className},
    (identifierName, file) => [
      ...getClassComment(type),
      `interface ${identifierName} {`,
      ...type.attributes
        .map((attribute) => [
          ...getAttributeComment(attribute),
          `  ${attribute.attributeName}: ${getAttributeType(
            type,
            attribute,
            context,
            file,
          )}`,
        ])
        .reduce((a, b) => [...a, ...b], []),
      `}`,
    ],
  );
  const InsertParameters = context.printer.pushTypeDeclaration(
    {type: 'insert_parameters', name: type.className},
    (identifierName, file) => [
      ...getClassComment(type),
      `interface ${identifierName} {`,
      ...type.attributes
        .map((attribute) => [
          ...getAttributeComment(attribute),
          `  ${attribute.attributeName}${optionalOnInsert(
            attribute,
          )}: ${getAttributeType(type, attribute, context, file)}`,
        ])
        .reduce((a, b) => [...a, ...b], []),
      `}`,
    ],
  );
  return {DatabaseRecord, InsertParameters};
}

function getClassComment(cls: ClassDetails): string[] {
  const commentLines = [];
  if (cls.comment?.trim()) {
    commentLines.push(...cls.comment.trim().split('\n'));
  }
  if (commentLines.length) {
    return [`/**`, ...commentLines.map((l) => ` * ${l}`), ` */`];
  } else {
    return [];
  }
}
function getAttributeComment(attribute: Attribute): string[] {
  const commentLines = [];
  if (attribute.comment?.trim()) {
    commentLines.push(...attribute.comment.trim().split('\n'));
  }
  if (attribute.default) {
    if (commentLines.length) commentLines.push(``);
    commentLines.push(`@default ${attribute.default}`);
  }
  if (commentLines.length) {
    return [`  /**`, ...commentLines.map((l) => `   * ${l}`), `   */`];
  } else {
    return [];
  }
}

function getAttributeType(
  type: ClassDetails,
  attribute: Attribute,
  context: PgPrintContext,
  file: FileContext,
): string {
  if (!attribute.notNull) {
    return `(${getAttributeType(
      type,
      {...attribute, notNull: true},
      context,
      file,
    )}) | null`;
  }

  const columnTypeOverride =
    context.options.columnTypeOverrides[
      `${type.schemaName}.${type.className}.${attribute.attributeName}`
    ] ||
    context.options.columnTypeOverrides[
      `${type.className}.${attribute.attributeName}`
    ];
  if (columnTypeOverride) {
    return columnTypeOverride;
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
        return handleBrand(type.className, attribute, context, file);
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
  className: string,
  attribute: Attribute,
  context: PgPrintContext,
  file: FileContext,
): string {
  switch (context.options.primaryKeyTypeMode) {
    case 'strict_brand':
    case 'loose_brand':
      return file.getImport(
        context.printer.pushTypeDeclaration(
          {
            type: 'primary_key',
            name: className,
            columnName: attribute.attributeName,
          },
          (identifierName, file) => [
            `type ${identifierName} = ${context.getTypeScriptType(
              attribute.typeID,
              file,
            )}${getBrand(context, className, attribute)}`,
          ],
        ),
      );
    case 'inline_loose_brand':
    case 'inline_strict_brand':
    case 'inline_no_brand':
      return `${context.getTypeScriptType(attribute.typeID, file)}${getBrand(
        context,
        className,
        attribute,
      )}`;
  }
}

function getBrand(
  context: PgPrintContext,
  className: string,
  attribute: Attribute,
): string {
  switch (context.options.primaryKeyTypeMode) {
    case 'inline_loose_brand':
    case 'loose_brand':
      return ` & {readonly __brand?: '${className}_${attribute.attributeName}'}`;
    case 'inline_strict_brand':
    case 'strict_brand':
      return ` & {readonly __brand: '${className}_${attribute.attributeName}'}`;
    case 'inline_no_brand':
      return '';
  }
}
