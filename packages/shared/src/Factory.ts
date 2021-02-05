export interface Disposable {
  dispose(): Promise<void>;
}
export interface TransactionFactory<TDriver, TTransaction extends Disposable> {
  createTransaction(driver: TDriver): TTransaction;
}
export interface ConnectionFactory<TDriver, TConnection extends Disposable> {
  createConnection(driver: TDriver): TConnection;
}
export default interface Factory<
  TDriver,
  TConnection extends Disposable,
  TTransaction extends Disposable
>
  extends ConnectionFactory<TDriver, TConnection>,
    TransactionFactory<TDriver, TTransaction> {}
