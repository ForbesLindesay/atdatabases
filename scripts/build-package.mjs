import {build} from 'tsdown';

const name = process.argv[2];
console.log(`== Building ${name} ==`);
await build({
  cwd: `packages/${name}`,

  // Bundler settings
  entry:
    name === `sql`
      ? ['src/index.ts', 'src/web.ts']
      : name === 'pg-test' || name === 'mysql-test'
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

console.log();
console.log();
console.log();
