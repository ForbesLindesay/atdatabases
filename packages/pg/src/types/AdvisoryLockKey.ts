type AdvisoryLockKey =
  | bigint
  | number
  | `${number}`
  | readonly [number, number];

export default AdvisoryLockKey;
