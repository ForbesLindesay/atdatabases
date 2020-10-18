// export type ResultMap<TSuccess, TError> = <TNewSuccess>(
//   fn: (value: TSuccess) => TNewSuccess,
// ) => Result<TNewSuccess, TError>;
// export type ResultFlatMap<TSuccess, TError> = <TNewSuccess, TNewError>(
//   fn: (value: TSuccess) => Result<TNewSuccess, TNewError>,
// ) => Result<TNewSuccess, TError | TNewError>;

type Result<TSuccess, TError> =
  | {readonly ok: true; readonly value: TSuccess}
  | {readonly ok: false; readonly reason: TError};

export function ok(): {readonly ok: true; readonly value: void};
export function ok<TSuccess>(
  value: TSuccess,
): {readonly ok: true; readonly value: TSuccess};
export function ok<TSuccess>(
  value?: TSuccess,
): {readonly ok: true; readonly value?: TSuccess} {
  return {ok: true, value};
}

export function fail<TError>(
  reason: TError,
): {readonly ok: false; readonly reason: TError} {
  return {ok: false, reason};
}

const Result = {ok, fail};

export default Result;
