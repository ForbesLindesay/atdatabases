interface Task {
  start: number;
  write: boolean;
  fn: () => Promise<void>;
}
export default class Mutex {
  readonly maxWaitTimeout: number;
  tasks: Task[] = [];
  running = 0;
  runningWrite = false;
  constructor(maxWaitTimeout: number = 100) {
    this.maxWaitTimeout = maxWaitTimeout;
  }
  _taskStart = (runningWrite: boolean) => {
    this.running++;
    this.runningWrite = runningWrite;
  };
  _taskEnd = () => {
    this.running--;
    this.runningWrite = false;
    while (this.tasks.length && !this.tasks[0].write) {
      this._taskStart(false);
      this.tasks.shift()!.fn().then(this._taskEnd, this._taskEnd);
    }
    if (!this.running && this.tasks.length) {
      this._taskStart(true);
      this.tasks.shift()!.fn().then(this._taskEnd, this._taskEnd);
    }
  };
  async readLock<T>(fn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    if (
      this.runningWrite ||
      this.tasks.some((t) => t.write && now - t.start > this.maxWaitTimeout)
    ) {
      return new Promise((resolve, reject) => {
        this.tasks.push({
          start: now,
          write: false,
          fn: async () => {
            try {
              resolve(await fn());
            } catch (ex) {
              reject(ex);
            }
          },
        });
      });
    } else {
      this._taskStart(false);
      try {
        return await fn();
      } finally {
        this._taskEnd();
      }
    }
  }
  async writeLock<T>(fn: () => Promise<T>): Promise<T> {
    if (this.running) {
      return new Promise((resolve, reject) => {
        this.tasks.push({
          start: Date.now(),
          write: true,
          fn: async () => {
            try {
              resolve(await fn());
            } catch (ex) {
              reject(ex);
            }
          },
        });
      });
    } else {
      this._taskStart(true);
      try {
        return await fn();
      } finally {
        this._taskEnd();
      }
    }
  }
}
