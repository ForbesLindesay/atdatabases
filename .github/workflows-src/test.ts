import {readdirSync, statSync} from 'fs';
import createWorkflow, {Job, Steps} from 'github-actions-workflow-builder';
import {runner} from 'github-actions-workflow-builder/context';
import {
  Expression,
  hashFiles,
  interpolate,
} from 'github-actions-workflow-builder/expression';

export function yarnInstallWithCache(nodeVersion: Expression<string>): Steps {
  return ({use, run}) => {
    const {
      outputs: {dir: yarnCacheDir},
    } = run<{dir: string}>(
      `Get yarn cache directory path`,
      `echo "::set-output name=dir::$(yarn cache dir)"`,
    );
    use('Enable Cache', 'actions/cache@v2', {
      with: {
        path: [
          interpolate`${yarnCacheDir}`,
          'node_modules',
          'packages/*/node_modules',
        ].join('\n'),
        key: interpolate`${runner.os}-${nodeVersion}-${hashFiles(
          'yarn.lock',
        )}-2`,
      },
    });
    run('yarn install --prefer-offline');
  };
}

export function buildCache(): Steps {
  return ({use}) => {
    for (const packageName of readdirSync(`${__dirname}/../../packages`)) {
      try {
        if (
          !statSync(
            `${__dirname}/../../packages/${packageName}/src`,
          ).isDirectory()
        ) {
          continue;
        }
      } catch (ex) {
        continue;
      }
      use(`Enable Cache for ${packageName}`, 'actions/cache@v2', {
        with: {
          path: [
            `packages/${packageName}/lib`,
            `packages/${packageName}/.last_build`,
          ].join('\n'),
          key: interpolate`build-output-${hashFiles(
            `packages/${packageName}/src`,
          )}`,
        },
      });
    }
  };
}

export function saveOutput(name: string, paths: string[]): Steps<string> {
  return ({use}) => {
    use(`Save output: ${name}`, 'actions/upload-artifact@v2', {
      with: {name, path: paths.join('\n')},
    });
    return name;
  };
}
export function loadOutput(name: Expression<string>, path: string): Steps {
  return ({use}) => {
    use(interpolate`Load output: ${name}`, 'actions/download-artifact@v2', {
      with: {name, path},
    });
  };
}

export function buildJob(): Job<{output: string}> {
  return ({add, use, run}) => {
    use('actions/checkout@v2');
    use('actions/setup-node@v1', {
      with: {
        'node-version': '14.x',
        'registry-url': 'https://registry.npmjs.org',
      },
    });

    add(yarnInstallWithCache('14.x'));
    add(buildCache());

    run('yarn build');

    const output = add(
      saveOutput('build', ['packages/*/lib', 'packages/*/.last_build']),
    );
    return {output};
  };
}

export default createWorkflow(({setWorkflowName, addTrigger, addJob}) => {
  setWorkflowName('Test');

  addTrigger('push', {branches: ['master']});
  addTrigger('pull_request', {branches: ['master']});

  const build = addJob('build', buildJob());
  addJob('test', ({addDependencies, add, run, use}) => {
    const {
      outputs: {output: buildOutput},
    } = addDependencies(build);

    use('actions/checkout@v2');
    use('actions/setup-node@v1', {
      with: {
        'node-version': '14.x',
        'registry-url': 'https://registry.npmjs.org',
      },
    });

    add(yarnInstallWithCache('14.x'));

    add(loadOutput(buildOutput, 'packages/'));

    run('yarn build');
  });
});
