import * as MockDb from '@databases/mock-db';
import * as MockDbTyped from '@databases/mock-db-typed';

let id = parseInt(`aaaa`, 32);
if (typeof self !== 'undefined') {
  const modules = new Map<string, any>([
    ['@databases/mock-db', MockDb],
    ['@databases/mock-db-typed', MockDbTyped],
  ]);
  self.addEventListener('message', (event) => {
    const {code}: {code: string} = event.data;
    const consoleMethod = (method: string) => {
      return (...args: any[]) => {
        (self as any).postMessage({
          type: 'console',
          message: {
            method,
            id: `${(id++).toString(32)}-${Math.random()
              .toString(32)
              .substr(2)}`,
            data: args,
          },
        });
      };
    };
    const c = {
      debug: consoleMethod(`debug`),
      log: consoleMethod(`log`),
      info: consoleMethod(`info`),
      warn: consoleMethod(`warn`),
      error: consoleMethod(`error`),
      table: consoleMethod(`table`),
      dir: consoleMethod(`dir`),
    };
    let i = 0;
    const formattedCode = `async function run() {${code.replace(
      /import\s*(\b[a-z0-9$_]+\b)?\s*\,?\s*(\{[^\}]+\})?\s*\bfrom\b\s*((?:\'|\")[^\'\"]+(?:\'|\"))/gim,
      (_, defaultSpecifier, namedSpecifier, source) => {
        const id = `__module__${source.replace(/[^a-z0-9]/gi, `_`)}_${i++}`;
        return [
          `const ${id} = __modules__.get(${source})`,
          `if (${id} === undefined) throw new Error(${JSON.stringify(
            `Module not found: ${source}`,
          )})`,
          ...(defaultSpecifier
            ? [
                `const ${defaultSpecifier} = ${id} && ${id}.default ? ${id}.default : ${id}`,
              ]
            : []),
          ...(namedSpecifier
            ? [`const ${namedSpecifier.replace(/ as /g, ': ')} = ${id}`]
            : []),
        ].join(`;`);
      },
    )}}\nreturn run();`;
    const result = Function(
      `__modules__,console`,
      `async function run() {${formattedCode}}\nreturn run();`,
    )(modules, c);
    result.then(
      () => {
        (self as any).postMessage({type: `resolve`});
      },
      (err: any) => {
        (self as any).postMessage({type: `reject`, err});
      },
    );
  });
}
export {};
