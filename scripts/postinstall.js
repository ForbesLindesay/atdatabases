const {
  readdirSync,
  writeFileSync,
  statSync,
  readFileSync,
  existsSync,
} = require('fs');

const LICENSE = readFileSync(__dirname + '/../LICENSE.md');

const PACKAGE_KEY_ORDER = [
  `name`,
  `version`,
  `description`,
  `type`,
  `files`,
  `exports`,
  `bin`,
  `types`,
  `dependencies`,
  `devDependencies`,
  `peerDependencies`,
  `engines`,
  `scripts`,
  `repository`,
  `bugs`,
  `homepage`,
  `publishConfig`,
  `license`,
];
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
  let before = '';
  try {
    before = readFileSync(
      __dirname + '/../packages/' + directory + '/package.json',
      'utf8',
    );
  } catch (ex) {
    if (ex.code !== 'ENOENT') {
      throw ex;
    }
  }
  const pkg = JSON.parse(before || '{}');
  if (!pkg.name) {
    pkg.name = '@databases/' + directory;
  }
  packageNames.push(pkg.name);
  if (!pkg.version) {
    pkg.version = '0.0.0';
  }
  if (!pkg.description) {
    pkg.description = '';
  }
  pkg.type = 'module';
  pkg.files = ['dist/'];
  pkg.types = './dist/index.d.ts';
  pkg.exports = pkg.exports ?? {
    '.': './dist/index.js',
    './package.json': './package.json',
  };
  if (!pkg.dependencies) {
    pkg.dependencies = {};
  }
  if (!pkg.scripts) {
    pkg.scripts = {};
  }
  pkg.engines = {
    node: '>= 20.20.1',
  };
  pkg.repository = {
    type: 'git',
    url: 'git+https://github.com/ForbesLindesay/atdatabases.git',
    directory: `packages/${directory}`,
  };
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
  const after =
    JSON.stringify(
      Object.fromEntries(
        Object.entries(pkg)
          .filter(([name]) => name !== `main`)
          .sort(([a], [b]) => {
            const aIndex = PACKAGE_KEY_ORDER.indexOf(a);
            const bIndex = PACKAGE_KEY_ORDER.indexOf(b);
            if (aIndex === -1)
              throw new Error(`Unknown package.json key: ${a}`);
            if (bIndex === -1)
              throw new Error(`Unknown package.json key: ${b}`);
            return aIndex - bIndex;
          }),
      ),
      null,
      '  ',
    ) + '\n';
  if (before !== after) {
    writeFileSync(
      __dirname + '/../packages/' + directory + '/package.json',
      after,
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
  // "references": ${deps.length ? `[${deps}\n  ],` : `[],`}
  writeFileSync(
    __dirname + '/../packages/' + directory + '/tsconfig.json',
    `{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "lib",
  },
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
