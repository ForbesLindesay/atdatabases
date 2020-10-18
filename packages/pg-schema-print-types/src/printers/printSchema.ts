import {Schema, ClassKind} from '@databases/pg-schema-introspect';
import PrintContext from '../PrintContext';
import printClassDetails from './printClassDetails';

export default function printSchema(type: Schema, context: PrintContext) {
  context.pushDeclaration({type: 'schema'}, (identifier, {getImport}) => [
    `interface ${identifier} {`,
    ...type.classes
      .filter((cls) => cls.kind === ClassKind.OrdinaryTable)
      .map((cls) => {
        const {DatabaseRecord, InsertParameters} = printClassDetails(
          cls,
          context,
        );
        return `  ${cls.className}: {record: ${getImport(
          DatabaseRecord,
        )}, insert: ${getImport(InsertParameters)}};`;
      }),
    `}`,
  ]);
}
