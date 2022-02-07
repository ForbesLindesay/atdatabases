import {
  escapeMySqlIdentifier,
  escapePostgresIdentifier,
  escapeSQLiteIdentifier,
} from '..';

test(`escapePostgresIdentifier`, () => {
  const e = (id: string) => expect(escapePostgresIdentifier(id));

  e(`foo`).toBe('"foo"');
  e(`foo_'bar'_BAZ`).toBe('"foo_\'bar\'_BAZ"');
  e(`foo bar bing`).toBe('"foo bar bing"');
  e(`hello "world"`).toBe('"hello ""world"""');
  // {
  //   const start = Date.now();
  //   for (let i = 0; i < 10_000_000; i++) {
  //     escapePostgresIdentifier(`hello "world"`);
  //   }
  //   const end = Date.now();
  //   console.log(end - start);
  // }
  // {
  //   const start = Date.now();
  //   for (let i = 0; i < 10_000_000; i++) {
  //     escapePostgresIdentifier(`hello_world`);
  //   }
  //   const end = Date.now();
  //   console.log(end - start);
  // }
});

test(`escapeMySqlIdentifier`, () => {
  const e = (id: string) => expect(escapeMySqlIdentifier(id));

  e(`foo`).toBe('`foo`');
  e(`foo_'bar'_BAZ`).toBe("`foo_'bar'_BAZ`");
  e(`foo bar bing`).toBe('`foo bar bing`');
  e(`hello \`world\``).toBe('`hello ``world```');
});

test(`escapeSQLiteIdentifier`, () => {
  const e = (id: string) => expect(escapeSQLiteIdentifier(id));

  e(`foo`).toBe('"foo"');
  e(`foo_'bar'_BAZ`).toBe('"foo_\'bar\'_BAZ"');
  e(`foo bar bing`).toBe('"foo bar bing"');
  e(`hello "world"`).toBe('"hello ""world"""');
});
