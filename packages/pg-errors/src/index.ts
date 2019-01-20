import SQLError from './SQLError';
import SQLErrorCode, {SQLErrorCodes} from './SQLErrorCode';

export {SQLError, SQLErrorCode};

export function isSQLError(error: any): error is SQLError {
  return (
    error &&
    typeof error === 'object' &&
    SQLErrorCodes.has((error as SQLError).code)
  );
}
