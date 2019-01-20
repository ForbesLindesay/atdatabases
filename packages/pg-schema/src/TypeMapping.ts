/**
 * TypeMapping maps database types onto typescript types.
 *
 * Key: an oid of a type, or a type name, or a fully qualified "SchemaName.TypeName"
 * Value: the string representation of a typescript type
 */
type TypeMapping = {[key in number | string]?: string};
export default TypeMapping;
