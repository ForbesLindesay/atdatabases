import connect, {sql} from '@databases/pg';
import {readFileSync} from 'fs';
import call from '../cli-function';
import {spawnBuffered} from 'modern-spawn';

jest.setTimeout(60_000);
if (!process.env.CI) {
  const cleanup = async () => {
    for (const volume of [
      'atdatabases-test-volume-1',
      'atdatabases-test-volume-2',
    ]) {
      // these may fail without harm, so we don't check the exit code
      await spawnBuffered('docker', ['kill', volume], {
        debug: false,
      });
      await spawnBuffered('docker', ['volume', 'rm', volume], {
        debug: false,
      });
    }
  };
  afterAll(cleanup);
  beforeAll(cleanup);
  test('integration', async () => {
    for (const volume of [
      'atdatabases-test-volume-1',
      'atdatabases-test-volume-2',
    ]) {
      await spawnBuffered('docker', ['volume', 'create', volume], {
        debug: true,
      }).getResult();
      await call([
        'start',
        '--persistVolume',
        volume,
        '--writeEnv',
        `${__dirname}/env-example-1`,
      ]);

      const dbURL = readFileSync(`${__dirname}/env-example-1`, 'utf8')
        .trim()
        .replace(/DATABASE_URL=/, '');
      expect(dbURL).toMatchSnapshot(`DATABASE_URL for ${volume}`);
      const db = connect(dbURL);
      await db.query(sql`CREATE TABLE entries (id INT NOT NULL PRIMARY KEY)`);
      await db.query(sql`INSERT INTO entries (id) VALUES (1), (2)`);
      await db.dispose();

      await call(['stop', '--persistVolume', volume]);

      await call(['start', '--persistVolume', volume]);

      const db2 = connect(dbURL);
      expect(await db2.query(sql`SELECT * FROM entries`)).toEqual([
        {id: 1},
        {id: 2},
      ]);
      await db2.dispose();

      await call(['stop', '--persistVolume', volume]);
    }
  });
} else {
  test.skip('Cannot run in CI because we need to control docker images');
}
