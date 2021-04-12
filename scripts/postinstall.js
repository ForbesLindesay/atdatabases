const {
  readdirSync,
  writeFileSync,
  statSync,
  readFileSync,
  existsSync,
} = require('fs');

const LICENSE = readFileSync(__dirname + '/../LICENSE.md');

const packageNames = [];
const packageDocs = new Map([
  ['@databases/expo', 'https://www.atdatabases.org/docs/websql'],
]);
readdirSync(__dirname + '/../packages').forEach((directory) => {
  if (directory === 'website') {
    return;
  }
  if (!statSync(__dirname + '/../packages/' + directory).isDirectory()) {
    return;
  }
  if (directory !== 'validate-unicode') {
    writeFileSync(
      __dirname + '/../packages/' + directory + '/LICENSE.md',
      LICENSE,
    );
  }
  let pkg = {};
  try {
    pkg = JSON.parse(
      readFileSync(
        __dirname + '/../packages/' + directory + '/package.json',
        'utf8',
      ),
    );
  } catch (ex) {
    if (ex.code !== 'ENOENT') {
      throw ex;
    }
  }
  packageNames.push(pkg.name);
  const before = JSON.stringify(pkg);
  if (!pkg.name) {
    pkg.name = '@databases/' + directory;
  }
  if (!pkg.version) {
    pkg.version = '0.0.0';
  }
  if (!pkg.description) {
    pkg.description = '';
  }
  if (!pkg.main) {
    pkg.main = './lib/index.js';
  }
  if (!pkg.types) {
    pkg.types = './lib/index.d.ts';
  }
  if (!pkg.dependencies) {
    pkg.dependencies = {};
  }
  if (!pkg.scripts) {
    pkg.scripts = {};
  }

  pkg.repository =
    'https://github.com/ForbesLindesay/atdatabases/tree/master/packages/' +
    directory;
  pkg.bugs = 'https://github.com/ForbesLindesay/atdatabases/issues';
  if (existsSync(__dirname + '/../docs/' + directory + '.md')) {
    packageDocs.set(pkg.name, 'https://www.atdatabases.org/docs/' + directory);
    pkg.homepage = 'https://www.atdatabases.org/docs/' + directory;
    writeFileSync(
      __dirname + '/../packages/' + directory + '/README.md',
      '# ' +
        pkg.name +
        '\n\n' +
        'For documentation, see ' +
        'https://www.atdatabases.org/docs/' +
        directory,
    );
  }
  pkg.license = 'MIT';
  if (!pkg.private) {
    pkg.publishConfig = {
      access: 'public',
    };
  }
  const after = JSON.stringify(pkg);
  if (before !== after) {
    writeFileSync(
      __dirname + '/../packages/' + directory + '/package.json',
      JSON.stringify(pkg, null, '  ') + '\n',
    );
  }
  const deps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ]
    .filter((dep) => dep.startsWith(`@databases/`))
    .map(
      (dep) =>
        `\n    {"path": ${JSON.stringify(
          `../${dep.substr(`@databases/`.length)}`,
        )}},`,
    )
    .join(``);
  writeFileSync(
    __dirname + '/../packages/' + directory + '/tsconfig.json',
    `{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "composite": true,
    "rootDir": "src",
    "outDir": "lib",
    "tsBuildInfoFile": "lib/tsconfig.tsbuildinfo",
  },
  "references": ${deps.length ? `[${deps}\n  ],` : `[],`}
}
`,
  );
});

writeFileSync(
  `scripts/tsconfig.json`,
  `{
  "extends": "../tsconfig.json",
  "references": [${packageNames
    .map(
      (n) =>
        `\n    {"path": ${JSON.stringify(
          `../packages/${n.substr(`@databases/`.length)}`,
        )}},`,
    )
    .join(``)}
  ],
}`,
);
const [README_HEADER, _table, README_FOOTER] = readFileSync(
  __dirname + '/../README.md',
  'utf8',
).split('<!-- VERSION_TABLE -->');

const versionsTable = `
Package Name | Version | Docs
-------------|---------|------
${packageNames
  .sort((a, b) =>
    packageDocs.has(a) && !packageDocs.has(b)
      ? -1
      : !packageDocs.has(a) && packageDocs.has(b)
      ? 1
      : a < b
      ? -1
      : 1,
  )
  .map(
    (name) =>
      `${name} | [![NPM version](https://img.shields.io/npm/v/${name}?style=for-the-badge)](https://www.npmjs.com/package/${name}) | ${
        packageDocs.has(name)
          ? `[${packageDocs.get(name)}](${packageDocs.get(name)})`
          : `Not documented yet`
      }`,
  )
  .join('\n')}
`;
writeFileSync(
  __dirname + '/../README.md',
  [README_HEADER, versionsTable, README_FOOTER || ''].join(
    '<!-- VERSION_TABLE -->',
  ),
);
