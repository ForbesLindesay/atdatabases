export enum PoolRecordState {
  Idle,
  Active,
  Disposed,
}

export default interface IPoolRecord<T> {
  state: PoolRecordState;
  connection: T | undefined;
  activateCount: number;
  shouldDestroy: boolean;
  idleTimeout: number | undefined;
}

export interface IIdlePoolRecord<T> extends IPoolRecord<T> {
  readonly state: PoolRecordState.Idle;
  readonly connection: T;
}

export interface IActivePoolRecord<T> extends IPoolRecord<T> {
  readonly state: PoolRecordState.Active;
  readonly connection: T;
}

export interface IDisposedPoolRecord<T> extends IPoolRecord<T> {
  readonly state: PoolRecordState.Disposed;
  readonly connection: undefined;
}

function setRecordState<T>(
  record: IActivePoolRecord<T>,
  state: PoolRecordState.Idle,
  onTimeout: (record: IIdlePoolRecord<T>) => void,
  timeoutMilliseconds: number | undefined,
): IIdlePoolRecord<T>;
function setRecordState<T>(
  record: IActivePoolRecord<T> | IIdlePoolRecord<T>,
  state: PoolRecordState.Active,
): IActivePoolRecord<T>;
function setRecordState<T>(
  record: IActivePoolRecord<T> | IIdlePoolRecord<T>,
  state: PoolRecordState.Disposed,
): IDisposedPoolRecord<T>;
function setRecordState<T>(
  record: IPoolRecord<T>,
  state: PoolRecordState,
  onTimeout?:
    | ((record: IActivePoolRecord<T>) => void)
    | ((record: IIdlePoolRecord<T>) => void),
  timeoutMilliseconds?: number | undefined,
): IPoolRecord<T> {
  if (record.idleTimeout !== undefined) {
    clearTimeout(record.idleTimeout);
  }
  if (onTimeout && timeoutMilliseconds) {
    record.idleTimeout = setTimeout(onTimeout, timeoutMilliseconds, record);
  }
  record.state = state;
  switch (state) {
    case PoolRecordState.Active:
      record.activateCount++;
      break;
    case PoolRecordState.Disposed:
      record.connection = undefined;
      break;
  }
  return record;
}

export {setRecordState};

export function isActivePoolRecord<T>(
  record: IPoolRecord<T>,
): record is IActivePoolRecord<T> {
  return record.state === PoolRecordState.Active;
}
export function isIdlePoolRecord<T>(
  record: IPoolRecord<T>,
): record is IIdlePoolRecord<T> {
  return record.state === PoolRecordState.Idle;
}
export function isDisposedPoolRecord<T>(
  record: IPoolRecord<T>,
): record is IDisposedPoolRecord<T> {
  return record.state === PoolRecordState.Disposed;
}

class PoolRecord<T> implements IPoolRecord<T> {
  public state = PoolRecordState.Idle;
  public connection: T | undefined;
  public activateCount = 0;
  public shouldDestroy = false;
  public idleTimeout: number | undefined;
  constructor(connection: T) {
    this.connection = connection;
  }
}

export function getPoolRecord<T>(connection: T): IIdlePoolRecord<T> {
  const record: IPoolRecord<T> = new PoolRecord(connection);
  if (!isIdlePoolRecord(record)) {
    throw new Error('Newly created records should alays be idle');
  }
  return record;
}
