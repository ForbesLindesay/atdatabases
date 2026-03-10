import createWorkflow from 'github-actions-workflow-builder';
import {secrets} from 'github-actions-workflow-builder/context';
import {setup} from './test';

export default createWorkflow(
  ({setWorkflowName, addTrigger, addJob, setPermissions, whenTrigger}) => {
    setWorkflowName('Release');

    addTrigger('repository_dispatch', {
      types: ['rollingversions_publish_approved'],
    });
    addTrigger('push'); // , {branches: ['master']});

    setPermissions({
      'id-token': 'write', // Required for OIDC to publish to NPM
      contents: 'write', // To create GitHub releases
    });

    whenTrigger('push', () => {
      addJob('publish_canary', ({add, run}) => {
        add(setup());
        run('yarn build');
        run(
          'npx rollingversions publish --canary $GITHUB_RUN_NUMBER --allow-any-branch',
          {
            env: {
              GITHUB_TOKEN: secrets.GITHUB_TOKEN,
            },
          },
        );
      });
    });
    whenTrigger('repository_dispatch', () => {
      addJob('publish', ({add, run}) => {
        add(setup());
        run('yarn build');
        run('npx rollingversions publish', {
          env: {
            GITHUB_TOKEN: secrets.GITHUB_TOKEN,
          },
        });
      });
    });
  },
);
