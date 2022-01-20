type TypeID =
  | {type: 'class'; name: string}
  | {type: 'insert_parameters'; name: string}
  | {type: 'primary_key'; name: string; columnName: string}
  | {type: 'domain'; name: string}
  | {type: 'enum'; name: string}
  | {type: 'schema'}
  | {type: 'serializeValue'}
  | {
      type: 're_export';
      of:
        | {type: 'class'; name: string}
        | {type: 'insert_parameters'; name: string};
    };
export default TypeID;
