export default interface MigrationStatus {
  id: string;
  index: number;
  name: string;
  is_applied: boolean;
  last_up: Date | null;
  last_down: Date | null;
}
