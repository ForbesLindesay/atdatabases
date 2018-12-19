import Operation from './Operation';

export default interface MigrationSpec {
  id: string;
  index: number;
  name: string;
  operation: () => Promise<Operation>;
}
