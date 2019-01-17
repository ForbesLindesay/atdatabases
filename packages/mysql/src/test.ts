import connect from './';

const db = connect();

(async () => {
  const [results, metadata] = await db.task(async c => {
    return (await c.conn.query(
      `SELECT 1 + 1 as foo;SELECT 40 + 2 as bar`,
      [],
    )) as any;
  });
  console.info(results);
  console.info(metadata);
  await db.dispose();
})().catch(ex => {
  console.error(ex.stack || ex);
  process.exit(1);
});
