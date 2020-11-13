---
id: pg-migrations
title: Maintaining a Postgres schema using migrations
sidebar_label: Migrations
---

The `@databases/pg-migrations` CLI helps you maintain your database schema.

## Installing

You can install it globally

```sh
yarn global add @databases/pg-migrations
```

```sh
npm i -g @databases/pg-migrations
```

or locally

```sh
yarn add -D @databases/pg-migrations
```

```sh
npm install --save-dev @databases/pg-migrations
```

If you install it locally, you will need to use `yarn pg-migrations` instead of just `pg-migrations` when running commands, but it makes it easier to make sure everyone on your team is on the same version.

## Usage

Create a directory for your migrations. In that directory, create a file called: `0001-initial-migration.sql`

- You can use any number, then a `-` and then any name.
- You can write migrations in SQL (with a `.sql` extension) or TypeScript (with a `.ts` extension)
- Migrations are run in numerical order. You can use sequential integers, or if you want to reduce the risk of collisions with multiple team members creating migrations, you could use a timestamp.

To run the migrations, run:

```sh
pg-migrations apply --directory my-migrations-directory
```

This will apply any pending migrations.

## Options

- `--database` - The connection string for your database
- `--directory` - The folder containing your migrations
- `--dry-run` - Check for inconsistencies and pending migrations without actually applying them
- `--help` - Print detailed usage info
