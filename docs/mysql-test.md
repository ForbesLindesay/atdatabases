---
id: mysql-test
title: MySQL Testing with Node.js
sidebar_label: Testing
---

The `@databases/mysql-test` library uses docker to allow you to run tests against a real MySQL database.

I've found that if your application has lots of complex business logic, and an extremely simple database schema/set of database queries, it makes sense to just mock out database calls in tests. However, I've also found applications where the code is just plumbing from a simple REST API to a database, where testing without a real database feels pretty pointless. Docker makes it remarkably simple to test your application against a real database. When I've tried this technique, it has only added a few seconds to each test run, and it's caught many bugs that would otherwise have made it into staging deployments.

## Installing

You should install docker: [Guide to installing docker](https://gist.github.com/rstacruz/297fc799f094f55d062b982f7dac9e41)

Then you can simply run:

```yarn
yarn add @databases/mysql-test
```

```npm
npm install @databases/mysql-test
```

to take care of the rest.

## Jest

To setup jest, add the following keys to your jest config:

```json
"globalSetup": "<rootDir>/node_modules/@databases/mysql-test/jest/globalSetup.js",
"globalTeardown": "<rootDir>/node_modules/@databases/mysql-test/jest/globalTeardown.js",
```

This will set up a MySQL server on a free port, before your tests run. It will tear down the MySQL server after all your tests run. N.B. Your tests will all share a single database, and execute in parallel, so you should not assume your generated IDs will have consistent values.

BAD:

```ts
expect(
  await db.query(sql`SELECT id, name FROM users WHERE name=${'Joe'}`),
).toEqual([{id: 1, name: 'Joe'}]);
```

GOOD:

```ts
expect(
  await db.query(sql`SELECT id, name FROM users WHERE name=${'Joe'}`),
).toEqual([{id: expect.any(Number), name: 'Joe'}]);
```

If you need to run migrations before your tests run, e.g. to create database tables/setup test data, you can add a command to run in your mysql config. e.g. add the following to package.json:

```json
"scripts": {
  "migrations:test": "...run db migrations..."
},
"mysql": {
  "test": {
    "migrationsScript": "yarn run migrations:test"
  }
}
```

Your migrations script will run with the `DATABASE_URL` set to the same value as for your tests.

## CLI

To install as a CLI:

```npm
npm i -g @databases/mysql-test
```

To start a local MySQL database on a free port, and apply any migrations you have configured (see Jest), you can run:

```
mysql-test start
```

When you're done with your database, you can dispose of it via:

```
mysql-test stop
```

If you have a script (e.g. a node.js server) that you need a MySQL database for, and you're happy for that MySQL database to be disposed of as soon as your script exits, you can do that via:

```
mysql-test run -- node my-server.js
```

The `--` is optional, but can be used to clarify where the `mysql-test` parameters end and your script begins.

## Circle CI

If the `DATABASE_URL` environment is already set, `mysql-test` does nothing. This means you can use CircleCI's native support for running tests with an acompanying database to run your tests. In your `.circleci/config.yml`:

```yaml
version: 2

refs:
  container: &container
    docker:
      - image: node:10
        environment:
          DATABASE_URL: 'mysql://test-user:password@localhost:3306/test-db'
      - image: circleci/mysql:5.7.24
        environment:
          MYSQL_USER: test-user
          MYSQL_PASSWORD: password
          MYSQL_DATABASE: test-db

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
import getDatabase from '@databases/mysql-test';

async function prepare() {
  const {databaseURL, kill} = await getDatabase(options);
}
```

The `getDatabase` function returns a database connection string as `databaseURL` and `kill`, which kills the MySQL database server.

If you want to exactly mimic the jest functionality you can use:

```ts
import mysqlSetup from '@databases/mysql-test/jest/globalSetup';
import mysqlTeardown from '@databases/mysql-test/jest/globalTeardown';

async function test() {
  await mysqlSetup();
  // ... run you tests ...
  await mysqlTeardown();
}
```
