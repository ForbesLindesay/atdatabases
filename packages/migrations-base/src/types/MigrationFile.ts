export default interface MigrationFile {
  readonly index: number;
  readonly name: string;
  readonly script: string;
}
