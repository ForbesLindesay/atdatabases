type TypeID =
  | {type: 'class'; name: string}
  | {type: 'insert_parameters'; name: string}
  | {type: 'primary_key'; name: string; columnName: string}
  | {type: 'domain'; name: string}
  | {type: 'enum'; name: string}
  | {type: 'schema'};
export default TypeID;

export const DEFAULT_EXPORT_PRIORITY = {
  schema: 0,
  class: 1,
  insert_parameters: 2,
  primary_key: 2,
  enum: 2,
  domain: 2,
};
