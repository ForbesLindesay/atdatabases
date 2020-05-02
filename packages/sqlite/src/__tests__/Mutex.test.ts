import Mutex from '../Mutex';

async function delay(ms: number) {
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
}
test('Allows parallel read queries', async () => {
  const mutex = new Mutex();
  const results: string[] = [];
  await Promise.all([
    mutex.readLock(async () => {
      results.push('START R1');
      await delay(100);
      results.push('END R1');
    }),
    mutex.readLock(async () => {
      results.push('START R2');
      await delay(300);
      results.push('END R2');
    }),
    mutex.readLock(async () => {
      results.push('START R3');
      await delay(200);
      results.push('END R3');
    }),
  ]);
  expect(results).toMatchInlineSnapshot(`
Array [
  "START R1",
  "START R2",
  "START R3",
  "END R1",
  "END R3",
  "END R2",
]
`);
});

test('Only Allows One Write', async () => {
  const mutex = new Mutex();
  const results: string[] = [];
  await Promise.all([
    mutex.readLock(async () => {
      results.push('START R1');
      await delay(100);
      results.push('END R1');
    }),
    mutex.writeLock(async () => {
      results.push('START W1');
      await delay(100);
      results.push('END W1');
    }),
    mutex.writeLock(async () => {
      results.push('START W2');
      await delay(100);
      results.push('END W2');
    }),
    mutex.readLock(async () => {
      results.push('START R2');
      await delay(300);
      results.push('END R2');
    }),
    mutex.readLock(async () => {
      results.push('START R3');
      await delay(200);
      results.push('END R3');
    }),
    mutex.writeLock(async () => {
      results.push('START W3');
      await delay(100);
      results.push('END W3');
    }),
  ]);
  const a = [
    mutex.readLock(async () => {
      results.push('START R4');
      await delay(300);
      results.push('END R4');
    }),
    mutex.writeLock(async () => {
      results.push('START W4');
      await delay(100);
      results.push('END W4');
    }),
  ];
  await delay(200);
  await Promise.all([
    ...a,
    // because W4 has already been waiting for 200ms
    // this read queues behind it instead of jumping
    // the queue like R2 and R3 did
    mutex.readLock(async () => {
      results.push('START R5');
      await delay(300);
      results.push('END R5');
    }),
  ]);

  expect(results).toMatchInlineSnapshot(`
Array [
  "START R1",
  "START R2",
  "START R3",
  "END R1",
  "END R3",
  "END R2",
  "START W1",
  "END W1",
  "START W2",
  "END W2",
  "START W3",
  "END W3",
  "START R4",
  "END R4",
  "START W4",
  "END W4",
  "START R5",
  "END R5",
]
`);
});
