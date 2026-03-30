// export type ResultMap<TSuccess, TError> = <TNewSuccess>(
//   fn: (value: TSuccess) => TNewSuccess,
// ) => Result<TNewSuccess, TError>;
// export type ResultFlatMap<TSuccess, TError> = <TNewSuccess, TNewError>(
//   fn: (value: TSuccess) => Result<TNewSuccess, TNewError>,
// ) => Result<TNewSuccess, TError | TNewError>;

type ResultOk<TSuccess> = {readonly ok: true; readonly value: TSuccess};
type ResultFail<TError> = {readonly ok: false; readonly reason: TError};
type Result<TSuccess, TError> = ResultOk<TSuccess> | ResultFail<TError>;

export function ok(): ResultOk<void>;
export function ok<TSuccess>(value: TSuccess): ResultOk<TSuccess>;
export function ok<TSuccess>(value?: TSuccess): ResultOk<TSuccess | void> {
  return {ok: true, value};
}

export function fail<TError>(reason: TError): ResultFail<TError> {
  return {ok: false, reason};
}

interface ResultApi {
  ok(): ResultOk<void>;
  ok<TSuccess>(value: TSuccess): ResultOk<TSuccess>;
  fail<TError>(reason: TError): ResultFail<TError>;
}
const Result: ResultApi = {ok, fail};

export default Result;
