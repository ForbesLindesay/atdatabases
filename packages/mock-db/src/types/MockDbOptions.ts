import EventHandlers from './EventHandlers';

export default interface MockDbOptions {
  acquireLockTimeoutMilliseconds: number;
  dbName: string;
  handlers: EventHandlers;
}
