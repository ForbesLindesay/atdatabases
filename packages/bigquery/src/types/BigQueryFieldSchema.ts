export interface BigQueryFieldSchemaBase {
  name: string;
  /**
   * [Optional] The field mode. Possible values include NULLABLE, REQUIRED and REPEATED. The default value is NULLABLE.
   */
  mode?: 'NULLABLE' | 'REQUIRED' | 'REPEATED';
  /**
   * The field description. The maximum length is 1,024 characters.
   */
  description?: string;
  /**
   * The categories attached to this field, used for field-level access control.
   */
  categories?: {
    /**
     * A list of category resource names. For example, "projects/1/taxonomies/2/categories/3". At most 5 categories are allowed.
     */
    names: string[];
  };
  policyTags?: {
    /**
     * A list of category resource names. For example, "projects/1/location/eu/taxonomies/2/policyTags/3". At most 1 policy tag is allowed.
     */
    names: string[];
  };
}

export interface BigQuerySimpleFieldSchema extends BigQueryFieldSchemaBase {
  type:
    | 'STRING'
    | 'BYTES'
    | 'INTEGER'
    | 'INT64' // same as INTEGER
    | 'NUMERIC'
    | 'FLOAT'
    | 'FLOAT64' // same as FLOAT
    | 'BOOLEAN'
    | 'BOOL' // same as BOOLEAN
    | 'TIMESTAMP'
    | 'DATE'
    | 'TIME'
    | 'DATETIME';
}

export interface BigQueryRecordFieldSchema extends BigQueryFieldSchemaBase {
  type:
    | 'RECORD' // where RECORD indicates that the field contains a nested schema
    | 'STRUCT'; // same as RECORD
  /**
   * Describes the nested schema fields if the type property is set to RECORD.
   */
  fields: BigQueryFieldSchema[];
}

type BigQueryFieldSchema =
  | BigQueryRecordFieldSchema
  | BigQuerySimpleFieldSchema;

export default BigQueryFieldSchema;
