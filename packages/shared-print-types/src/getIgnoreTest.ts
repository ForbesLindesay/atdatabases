export interface IgnoreOptions {
  /**
   * Tables you want to generate types for. Use
   * null to generate types for all tables
   *
   * @default null
   */
  includeTables: string[] | null;

  /**
   * Tables you do not want to generate types for.
   * Overrides includeTables
   *
   * @default []
   */
  ignoreTables: string[];
}
export default function getIgnoreTest(options: Partial<IgnoreOptions>) {
  const includeTables = options.includeTables
    ? new Set(options.includeTables)
    : null;
  const ignoreTables = new Set(options.ignoreTables ?? []);
  const isTableIgnored = (tableName: string) => {
    return (
      (includeTables !== null && !includeTables.has(tableName)) ||
      ignoreTables.has(tableName)
    );
  };
  return isTableIgnored;
}
