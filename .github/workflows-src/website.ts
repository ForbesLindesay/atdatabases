import createWorkflow from 'github-actions-workflow-builder';
import {github, secrets} from 'github-actions-workflow-builder/context';
import {
  eq,
  hashFiles,
  interpolate,
  neq,
} from 'github-actions-workflow-builder/expression';
import {buildCache, setup} from './test';

export default createWorkflow(({setWorkflowName, addTrigger, addJob}) => {
  setWorkflowName('Website');

  addTrigger('push', {branches: ['master']});
  addTrigger('pull_request', {branches: ['master']});

  addJob('publish_website', ({add, run, use, when}) => {
    add(setup());

    add(buildCache());

    run('yarn build');

    use('Enable NextJS Cache', 'actions/cache@v2', {
      with: {
        path: ['packages/website/.next/cache'].join('\n'),
        key: interpolate`next-${hashFiles('yarn.lock')}`,
        'restore-keys': [`next-`].join('\n'),
      },
    });

    run('yarn workspace @databases/website build');

    // run(`npm install netlify-cli`);
    run(
      interpolate`mkdir .netlify && echo '{"siteId": "${secrets.NETLIFY_SITE_ID}"}' > .netlify/state.json`,
    );
    when(eq(github.event_name, `push`), () => {
      run(
        `netlify deploy --cwd . --filter @databases/website --prod --dir=packages/website/out`,
        {
          env: {
            NETLIFY_SITE_ID: secrets.NETLIFY_SITE_ID,
            NETLIFY_AUTH_TOKEN: secrets.NETLIFY_AUTH_TOKEN,
          },
        },
      );
    });
    when(neq(github.event_name, `push`), () => {
      run(
        `netlify deploy --cwd . --filter @databases/website --dir=packages/website/out`,
        {
          env: {
            NETLIFY_SITE_ID: secrets.NETLIFY_SITE_ID,
            NETLIFY_AUTH_TOKEN: secrets.NETLIFY_AUTH_TOKEN,
          },
        },
      );
    });
  });
});
