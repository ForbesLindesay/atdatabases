import connect, {sql} from '@databases/expo';
const React = require('react');
const {StyleSheet, Text, SafeAreaView, ScrollView} = require('react-native');

const styles: any = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
  },
});

const db = connect('my-database');

const ready = db.tx(function*(tx) {
  yield tx.query(sql`DROP TABLE IF EXISTS schema_version;`);
  yield tx.query(sql`DROP TABLE IF EXISTS tasks;`);
  yield tx.query(sql`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INT NOT NULL
    );
  `);
  const versionRecord = yield tx.query(sql`
    SELECT version FROM schema_version;
  `);
  const version = versionRecord.length ? versionRecord[0].version : 0;
  if (version < 1) {
    yield tx.query(sql`
      CREATE TABLE tasks (
        id TEXT NOT NULL PRIMARY KEY,
        name TEXT NOT NULL,
        completed BOOLEAN NOT NULL
      );
    `);
  }
  // to add other versions in the future,
  // we can just add extra if statements
  // and increase LATEST_VERSION
  const LATEST_VERSION = 1;
  if (version === 0) {
    yield tx.query(sql`
      INSERT INTO schema_version
      VALUES (${LATEST_VERSION});
    `);
  } else {
    yield tx.query(sql`
      UPDATE schema_version
      SET version = ${LATEST_VERSION};
    `);
  }
});

async function setTodo(id: string, name: string, completed: boolean) {
  await ready;
  await db.query(sql`
    INSERT INTO tasks (id, name, completed)
    VALUES (${id}, ${name}, ${completed})
    ON CONFLICT (id) DO UPDATE
    SET name=excluded.name, completed=excluded.completed;
  `);
}
async function getTodo(id: string) {
  await ready;
  return (
    (await db.query(sql`
    SELECT * FROM tasks WHERE id=${id};
  `))[0] || undefined
  );
}

async function getUnfinishedTodos() {
  return await db.query(sql`
    SELECT * FROM tasks WHERE completed=false;
  `);
}

const testResults = (async () => {
  const logs: string[] = [];
  let passed = true;
  try {
    await setTodo('a', 'Todo a', false);
    await setTodo('b', 'Todo b', false);
    await setTodo('c', 'Todo c', false);
    const b = await getTodo('b');
    if (b.id !== 'b') {
      throw new Error('expected b.id to be "b"');
    }
    if (b.name !== 'Todo b') {
      throw new Error('expected b.name to be "Todo b"');
    }
    if (b.completed !== 0) {
      throw new Error('expected b.completed to be 0');
    }
    logs.push('todo b: ' + JSON.stringify(b));
    await setTodo('b', 'Todo b - modified', true);
    const bModified = await getTodo('b');
    if (bModified.id !== 'b') {
      throw new Error('expected bModified.id to be "b"');
    }
    if (bModified.name !== 'Todo b - modified') {
      throw new Error('expected bModified.name to be "Todo b -modified"');
    }
    if (bModified.completed !== 1) {
      throw new Error('expected bModified.completed to be 1');
    }
    logs.push('todo b modified: ' + JSON.stringify(bModified));
    const unfinished = await getUnfinishedTodos();
    if (unfinished.length !== 2) {
      throw new Error('expected unfinished.length to be 2');
    }
    if (unfinished[0].id !== 'a') {
      throw new Error('expected unfinished[0].id to be "a"');
    }
    if (unfinished[1].id !== 'c') {
      throw new Error('expected unfinished[1].id to be "c"');
    }
    logs.push('unfinished todos: ' + JSON.stringify(unfinished));
  } catch (ex) {
    logs.push(`${ex.message}\n\n${ex.stack}`);
    console.error(`${ex.message}\n\n${ex.stack}`);
    passed = false;
  }
  return [logs, passed] as const;
})();

type PromiseResult<T> = T extends Promise<infer S> ? S : unknown;
export default function App() {
  const [[logs, passed], setResult]: [
    PromiseResult<typeof testResults>,
    (logs: PromiseResult<typeof testResults>) => void,
  ] = React.useState([[], null]);
  React.useEffect(() => {
    // tslint:disable-next-line: no-floating-promises
    testResults.then(results => setResult(results));
  }, []);
  return (
    <SafeAreaView style={{flex: 1}}>
      <ScrollView style={styles.container}>
        {logs.map((log, i) => (
          <Text key={i}>{log}</Text>
        ))}
        <Text
          style={{
            color: passed == null ? 'yellow' : passed ? 'green' : 'red',
            fontSize: 50,
            textAlign: 'center',
            marginTop: 100,
          }}
        >
          {passed == null ? 'pending' : passed ? 'passed' : 'failed'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
