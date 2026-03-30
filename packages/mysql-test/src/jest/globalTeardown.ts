import {killers} from './globalSetup';

export default async function teardown(): Promise<void> {
  await Promise.all(killers.map(async (kill) => await kill()));
}
