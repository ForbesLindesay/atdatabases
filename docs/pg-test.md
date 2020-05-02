---
id: pg-test
title: Postgres Testing
sidebar_label: Testing
---

The `@databases/pg-test` library uses docker to allow you to run tests against a real postgres database.

I've found that if your application has lots of complex business logic, and an extremely simple database schema/set of database queries, it makes sense to just mock out database calls in tests. However, I've also found applications where the code is just plumbing from a simple REST API to a database, where testing without a real database feels pretty pointless. Docker makes it remarkably simple to test your application against a real database. When I've tried this technique, it has only added a few seconds to each test run, and it's caught many bugs that would otherwise have made it into staging deployments.

## Installing

You should install docker: [Guide to installing docker](https://gist.github.com/rstacruz/297fc799f094f55d062b982f7dac9e41)

Then you can simply run:

```
yarn add @databases/pg-test
```

to take care of the rest.

## Jest

To setup jest, add the following keys to your jest config:

```
"globalSetup": "<rootDir>/node_modules/@databases/pg-test/jest/globalSetup.js",
"globalTeardown": "<rootDir>/node_modules/@databases/pg-test/jest/globalTeardown.js",
```

This will set up an in-memory postrgres server on a free port, before your tests run. It will tear down the postrgres server after all your tests run. N.B. Your tests will all share a single database, and execute in parallel, so you should not assume your generated IDs will have consistent values.

BAD:

```ts
expect(
  await db.query(sql`SELECT id, name FROM users WHERE name=${'Joe'}`)
).toEqual(
  [{id: 1, name: 'Joe'}]
);
```

GOOD:

```ts
expect(
  await db.query(sql`SELECT id, name FROM users WHERE name=${'Joe'}`)
).toEqual(
  [{id: expect.any(Number), name: 'Joe'}]
);
```

If you need to run migrations before your tests run, e.g. to create database tables/setup test data, you can add a command to run in your pg config.  e.g. add the following to package.json:

```
"scripts" {
  "migrations:test": "...run db migrations..."
},
"pg": {
  "test": {
    "migrationsScript": [
      "yarn",
      "run",
      "migrations:test"
    ]
  }
}
```

Your migrations script will run with the `DATABASE_URL` set to the same value as for your tests.

## Circle CI

If the `DATABASE_URL` environment is already set, `pg-test` does nothing. This means you can use CircleCI's native support for running tests with an acompanying database to run your tests. In your `.circleci/config.yml`:

```yaml
version: 2

refs:

  container: &container
    docker:
      - image: node:10
        environment:
          DATABASE_URL: 'postgres://test-user@localhost:5432/test-db'
      - image: postgres:10.6-alpine
        environment:
          POSTGRES_USER: test-user
          POSTGRES_DB: test-db

    working_directory: ~/repo

  steps:
    - &Install
      run:
        name: Install Dependencies
        command: yarn install --frozen-lockfile
    - &Test
      run:
        name: Test
        command: yarn ci:test
    - &Run_Migrations
      run:
        name: Run migrations
        command: yarn migrations:test

jobs:
  all:
    <<: *container
    steps:
      - checkout
      - *Install
      - *Run_Migrations
      - *Test

  deploy-staging:
    <<: *container
    steps:
      - checkout
      - *Install
      - *Run_Migrations
      - *Test
      - run: echo "Run migrations on staging db"
      - run: echo "Deploy to staging"
      - run: echo "Post to slack - deployment waiting for approval"
      - run:
          name: Post to Slack on FAILURE
          command: echo "Post to slack - staging build failed"
          when: on_fail

  deploy-prod:
    <<: *container
    steps:
      - checkout
      - *Install
      - *Run_Migrations
      - *Test
      - run: echo "Run migrations on production db"
      - run: echo "Deploy to production"
      - run:
          name: Post to Slack on FAILURE
          command: echo "Post to slack - production build failed"
          when: on_fail

  nightly:
    <<: *container
    steps:
      - checkout
      - *Install
      - *Test
      - run:
          name: Post to Slack on FAILURE
          command: echo "Post to slack - nightly build failed"
          when: on_fail

workflows:
  version: 2
  all:
    jobs:
      - all:
          filters:
            branches:
              ignore:
                - master

  master:
    jobs:
      - deploy-staging:
          filters:
            branches:
              only: master
      - approve-prod:
          type: approval
          requires:
            - deploy-staging
          filters:
            branches:
              only: master
      - deploy-prod:
          requires:
            - approve-prod
          filters:
            branches:
              only: master

  nightly:
    triggers:
      - schedule:
          cron: '0 1 * * *'
          filters:
            branches:
              only: master
    jobs:
      - nightly

```

## API

```ts
import getDatabase from '@databases/pg-test';

async function prepare() {
  const {databaseURL, kill} = await getDatabase(options);
}
```

The `getDatabase` function returns a database connection string as `databaseURL` and `kill`, which kills the postgres database server.

If you want to exactly mimic the jest functionality you can use:

```ts
import pgSetup from '@databases/pg-test/jest/globalSetup';
import pgTeardown from '@databases/pg-test/jest/globalTeardown';

async function test() {
  await pgSetup();
  // ... run you tests ...
  await pgTeardown();
}
```
