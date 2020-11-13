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
export function setup(nodeVersion: Expression<string> = '14.x'): Steps {
  return ({use, add}) => {
    use('actions/checkout@v2');
    use('actions/setup-node@v1', {
      with: {
        'node-version': nodeVersion,
        'registry-url': 'https://registry.npmjs.org',
      },
    });

    add(yarnInstallWithCache(nodeVersion));
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
          key: interpolate`v2-build-output-${hashFiles(
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
  return ({add, run}) => {
    add(setup());

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

  addJob('test_node', ({setBuildMatrix, addDependencies, add, run}) => {
    const {
      outputs: {output: buildOutput},
    } = addDependencies(build);

    const {node} = setBuildMatrix(
      {
        node: ['12.x', '14.x'],
      },
      {failFast: false},
    );

    add(setup(node));

    add(loadOutput(buildOutput, 'packages/'));

    run('yarn test:node');
  });

  addJob('test_pg', ({setBuildMatrix, addDependencies, add, run}) => {
    const {
      outputs: {output: buildOutput},
    } = addDependencies(build);

    const {node, pg} = setBuildMatrix(
      {
        node: ['12.x', '14.x'],
        pg: [
          // '9.6.19-alpine', -- unsupported by pg-migrations
          '10.14-alpine',
          '11.9-alpine',
          '12.4-alpine',
          '13.0-alpine',
        ],
      },
      {failFast: false},
    );

    add(setup(node));

    add(loadOutput(buildOutput, 'packages/'));

    run('yarn test:pg', {
      env: {PG_TEST_IMAGE: interpolate`postgres:${pg}`, PG_TEST_DEBUG: 'TRUE'},
    });
  });

  addJob('test_mysql', ({setBuildMatrix, addDependencies, add, run}) => {
    const {
      outputs: {output: buildOutput},
    } = addDependencies(build);

    const {node, mysql} = setBuildMatrix(
      {
        node: ['12.x', '14.x'],
        mysql: [
          '5.6.50',
          '5.7.32',
          // '8.0.22',
        ],
      },
      {failFast: false},
    );

    add(setup(node));

    add(loadOutput(buildOutput, 'packages/'));

    run('yarn test:mysql', {
      env: {MYSQL_TEST_IMAGE: interpolate`mysql:${mysql}`},
    });
  });

  addJob('prettier', ({addDependencies, add, run}) => {
    add(setup());

    run('yarn prettier:check');
  });

  addJob('lint', ({addDependencies, add, run}) => {
    const {
      outputs: {output: buildOutput},
    } = addDependencies(build);

    add(setup());

    add(loadOutput(buildOutput, 'packages/'));

    run('yarn tslint');
  });
});
