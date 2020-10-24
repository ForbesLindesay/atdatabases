import createWorkflow, {Job, Steps} from 'github-actions-workflow-builder';
import {runner} from 'github-actions-workflow-builder/context';
import {
  Expression,
  hashFiles,
  interpolate,
  neq,
} from 'github-actions-workflow-builder/expression';

export function yarnInstallWithCache(nodeVersion: Expression<string>): Steps {
  return ({use, run, when}) => {
    const {
      outputs: {dir: yarnCacheDir},
    } = run<{dir: string}>(
      `Get yarn cache directory path`,
      `echo "::set-output name=dir::$(yarn cache dir)"`,
    );
    use('Enable Cache', 'actions/cache@v2', {
      with: {
        path: yarnCacheDir,
        key: interpolate`${runner.os}-${nodeVersion}-${hashFiles('yarn.lock')}`,
      },
    });
    run('yarn install --prefer-offline');
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

    run('yarn build:all');

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
