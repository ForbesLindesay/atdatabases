const {
  readdirSync,
  writeFileSync,
  statSync,
  readFileSync,
  existsSync,
} = require('fs');

const LICENSE = readFileSync(__dirname + '/../LICENSE.md');

const tsconfigBuild = `{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "lib"
  }
}`;
const tsconfig = `{
  "extends": "../../tsconfig.json"
}`;

const packageNames = [];
readdirSync(__dirname + '/../packages').forEach((directory) => {
  if (!statSync(__dirname + '/../packages/' + directory).isDirectory()) {
    return;
  }
  if (directory !== 'validate-unicode') {
    writeFileSync(
      __dirname + '/../packages/' + directory + '/LICENSE.md',
      LICENSE,
    );
  }
  writeFileSync(
    __dirname + '/../packages/' + directory + '/tsconfig.json',
    tsconfig,
  );
  writeFileSync(
    __dirname + '/../packages/' + directory + '/tsconfig.build.json',
    tsconfigBuild,
  );
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
  if (before === after) {
    return;
  }
  writeFileSync(
    __dirname + '/../packages/' + directory + '/package.json',
    JSON.stringify(pkg, null, '  ') + '\n',
  );
});

const [README_HEADER, _table, README_FOOTER] = readFileSync(
  __dirname + '/../README.md',
  'utf8',
).split('<!-- VERSION_TABLE -->');

const versionsTable = `
Package Name | Version
-------------|--------
${packageNames
  .map(
    (name) =>
      `${name} | [![NPM version](https://img.shields.io/npm/v/${name}?style=for-the-badge)](https://www.npmjs.com/package/${name})`,
  )
  .join('\n')}
`;
writeFileSync(
  __dirname + '/../README.md',
  [README_HEADER, versionsTable, README_FOOTER || ''].join(
    '<!-- VERSION_TABLE -->',
  ),
);
