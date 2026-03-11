import * as fs from 'fs/promises';
import {spawn} from 'child_process';
import throttle from 'throat';

const buildPackage = throttle(4, async (name) => {
  const output = [];

  const bundleCode = await new Promise((resolve, reject) => {
    const child = spawn('node', ['scripts/build-package.mjs', name]);
    child.stdout?.on('data', (data) => {
      output.push([`stdout`, data]);
    });
    child.stderr?.on('data', (data) => {
      output.push([`stderr`, data]);
    });
    child.on('exit', resolve);
    child.on('error', reject);
  });

  const typecheckCode =
    bundleCode !== 0
      ? 0
      : await new Promise((resolve, reject) => {
          const child = spawn('npx', ['tsc', '--noEmit'], {
            cwd: 'packages/' + name,
          });
          child.stdout?.on('data', (data) => {
            output.push([`stdout`, data]);
          });
          child.stderr?.on('data', (data) => {
            output.push([`stderr`, data]);
          });
          child.on('exit', resolve);
          child.on('error', reject);
        });

  for (const [type, data] of output) {
    process[type].write(data);
  }
  if (bundleCode !== 0 || typecheckCode !== 0) {
    throw new Error(`Failed to build ${name}`);
  }
});

const packages = new Map();
for (const directory of await fs.readdir('packages')) {
  if (directory === 'website') {
    continue;
  }
  if (!(await fs.stat('packages/' + directory)).isDirectory()) {
    continue;
  }
  const pkg = JSON.parse(
    await fs.readFile('packages/' + directory + '/package.json', 'utf8'),
  );
  packages.set(pkg.name, {
    directory,
    dependencies: [
      ...Object.keys(pkg.dependencies || {}),
      ...Object.keys(pkg.devDependencies || {}),
      ...Object.keys(pkg.peerDependencies || {}),
    ],
  });
}

const builtPackages = new Map();
async function build({directory, dependencies}, path = []) {
  if (path.includes(directory)) {
    throw new Error(
      `Circular dependency detected: ${[...path, directory].join(' -> ')}`,
    );
  }
  const deduped = builtPackages.get(directory);
  if (deduped) {
    return await deduped;
  }
  const result = Promise.resolve().then(async () => {
    await Promise.all(
      dependencies.map(async (name) => {
        const dep = packages.get(name);
        if (dep) {
          await build(dep, [...path, directory]);
        }
      }),
    );
    await buildPackage(directory);
  });
  builtPackages.set(directory, result);
  return await result;
}

await Promise.all([...packages.values()].map((pkg) => build(pkg)));
