export default interface AppliedMigration {
  readonly index: number;
  readonly name: string;
  readonly script: string;
  readonly applied_at: Date;
  readonly ignored_error: string | null;
  readonly obsolete: boolean;
}
