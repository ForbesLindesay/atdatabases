export default interface IdleConnectionTracker {
  markIdle(): void;
  markInUse(): void;
}
