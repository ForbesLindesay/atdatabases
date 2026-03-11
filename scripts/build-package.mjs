import * as fs from 'fs/promises';
import {build} from 'tsdown';
import * as b from '@babel/core';

const directoryName = process.argv[2];

console.log(`== Building ${directoryName} ==`);
await build({
  cwd: `packages/${directoryName}`,
  outputOptions: {
    format: 'esm',
    externalLiveBindings: false, // assume that there are no circular dependencies between us and external packages.
    polyfillRequire: false, // TODO: ensure we don't use require
    // hoistTransitiveImports - not yet supported
    minifyInternalExports: false,
    cleanDir: true,
    // keepNames: true,
  },

  // Bundler settings
  entry:
    directoryName === `sql`
      ? ['src/index.ts', 'src/web.ts']
      : directoryName === 'pg-test' || directoryName === 'mysql-test'
      ? [
          'src/index.ts',
          'src/jest/globalSetup.ts',
          'src/jest/globalTeardown.ts',
        ]
      : `src/index.ts`,
  exports: true, // Update "exports" in package.json
  fixedExtension: false, // Use .js instead of .mjs for ESM - we have "type": "module" in package.json

  // Validation of outputs
  failOnWarn: true,
  attw: {
    // profile: 'strict',
    profile: 'esm-only',
    // ignoreRules: ['cjs-resolves-to-esm'],
  },
  publint: {
    strict: true,
  },
  deps: {
    onlyAllowBundle: [],
  },
  dts: {},
});

async function fixup(path) {
  if ((await fs.stat(path)).isDirectory()) {
    for (const entry of await fs.readdir(path)) {
      await fixup(`${path}/${entry}`);
    }
  }
  if (path.endsWith('.js') || path.endsWith('ts')) {
    let content = await fs.readFile(path, 'utf-8');
    const aliasesToRemove = new Map();
    const filename = path;
    const result = b.transformSync(content, {
      babelrc: false,
      parserOpts: {
        sourceFilename: path,
        sourceType: 'module',
        plugins: ['typescript'],
      },
      plugins: [
        {
          visitor: {
            Program(path) {
              for (const node of path.node.body) {
                const unaliasedSpecifiers = new Map();
                const aliasedSpecifiers = new Map();
                if (node.type === 'ImportDeclaration') {
                  for (const specifier of node.specifiers) {
                    if (specifier.type === 'ImportDefaultSpecifier') {
                      unaliasedSpecifiers.set('default', specifier.local);
                    }
                    if (specifier.type === 'ImportSpecifier') {
                      if (specifier.imported.name === specifier.local.name) {
                        unaliasedSpecifiers.set(
                          specifier.imported.name,
                          specifier.local,
                        );
                      } else {
                        aliasedSpecifiers.set(
                          specifier.local,
                          specifier.imported.name,
                        );
                      }
                    }
                  }
                }
                for (const [localName, importedName] of aliasedSpecifiers) {
                  const unaliasedLocalName =
                    unaliasedSpecifiers.get(importedName);
                  if (unaliasedLocalName) {
                    aliasesToRemove.set(localName.name, {
                      originalIdentifier: unaliasedLocalName,
                      aliasIdentifier: localName,
                    });
                  }
                }
              }
            },
            ImportSpecifier(path) {
              if (aliasesToRemove.has(path.node.local.name)) {
                path.remove();
              }
            },
            Identifier(path) {
              if (path.parent.type === 'ImportSpecifier') return;
              const alias = aliasesToRemove.get(path.node.name);
              if (alias) {
                const id = path.scope.getBindingIdentifier(path.node.name);
                if (id && id !== alias.aliasIdentifier) {
                  throw new Error(
                    `Unexpectedly found a different binding for ${path.node.name} in ${filename}`,
                  );
                }
                if (
                  path.scope.getBindingIdentifier(
                    alias.originalIdentifier.name,
                  ) !== alias.originalIdentifier
                ) {
                  throw new Error(
                    `Unexpectedly found a different binding for ${alias.originalIdentifier.name} in ${filename}`,
                  );
                }
                path.replaceWith(alias.originalIdentifier);
              } else if (
                /\$\d+^/.test(path.node.name) &&
                !(
                  directoryName === 'sql' &&
                  [`sql$1`, `SQL$1`].includes(path.node.name)
                )
              ) {
                throw new Error(
                  `Unexpectedly found a reference to ${path.node.name} in ${filename}`,
                );
              } else if (path.node.name === 'require') {
                throw new Error(
                  `Unexpectedly found a reference to require in ${filename}`,
                );
              }
            },
          },
        },
      ],
    });
    await fs.writeFile(path, result.code);
  }
}
await fixup(`packages/${directoryName}/dist`);

console.log();
console.log();
console.log();
