type TypeID =
  | {type: 'table'; name: string}
  | {type: 'insert_parameters'; name: string}
  | {type: 'primary_key'; name: string; columnName: string}
  | {type: 'schema'}
  | {type: 'serializeValue'};
export default TypeID;
