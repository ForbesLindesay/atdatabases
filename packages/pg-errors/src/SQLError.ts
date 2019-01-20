import SQLErrorCode from './SQLErrorCode';

export default interface SQLError extends Error {
  length: number;
  severity: string;
  code: SQLErrorCode;
  detail?: string;
  hint?: string;
  position?: string;
  internalPosition?: string;
  internalQuery?: string;
  where?: string;
  schema?: string;
  table?: string;
  column?: string;
  dataType?: string;
  constraint?: string;
  file?: string;
  line?: string;
  routine?: string;
}
