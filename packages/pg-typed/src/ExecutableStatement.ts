export interface ExecutableStatement<T> {
  execute(): Promise<T>;

  then<TResult1 = T, TResult2 = never>(
    onfulfilled?:
      | ((value: T) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onrejected?:
      | ((reason: any) => TResult2 | PromiseLike<TResult2>)
      | undefined
      | null,
  ): Promise<TResult1 | TResult2>;

  catch<TResult = never>(
    onrejected?:
      | ((reason: any) => TResult | PromiseLike<TResult>)
      | undefined
      | null,
  ): Promise<T | TResult>;

  finally(onfinally?: (() => void) | undefined | null): Promise<T>;
}
export abstract class ExecutableStatementImplementation<T>
  implements PromiseLike<T>
{
  private _executeCache: Promise<T> | null = null;
  private _executeWithCache(): Promise<T> {
    return this._executeCache || (this._executeCache = this._execute());
  }
  protected abstract _execute(): Promise<T>;
  protected _hasExecuted(): boolean {
    return this._executeCache !== null;
  }
  protected _assertNotExecuted(method: string): void {
    if (this._hasExecuted()) {
      throw new Error(
        `You cannot call ${method} after the statement has been executed.`,
      );
    }
  }

  execute() {
    if (this._hasExecuted()) {
      throw new Error('This statement has already been executed.');
    }
    return this._executeWithCache();
  }

  then<TResult1 = T, TResult2 = never>(
    onfulfilled?:
      | ((value: T) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onrejected?:
      | ((reason: any) => TResult2 | PromiseLike<TResult2>)
      | undefined
      | null,
  ): Promise<TResult1 | TResult2> {
    return this._executeWithCache().then<TResult1, TResult2>(
      onfulfilled,
      onrejected,
    );
  }

  catch<TResult = never>(
    onrejected?:
      | ((reason: any) => TResult | PromiseLike<TResult>)
      | undefined
      | null,
  ): Promise<T | TResult> {
    return this._executeWithCache().catch(onrejected);
  }

  finally(onfinally?: (() => void) | undefined | null): Promise<T> {
    return this._executeWithCache().finally(onfinally);
  }
}
