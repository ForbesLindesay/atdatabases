---
id: pg-provider-google-cloud
title: Connecting to Postgres in Google Cloud
sidebar_label: Google Cloud
---

This guide is for connecting to Cloud SQL Postgres instances in Google Cloud. If you're using a custom Postgres server or another cloud provider, refer to [Managing Postgres Connections](pg-guide-connections.md).

## Connect from Cloud Run

You may also find [the official google cloud docs](https://cloud.google.com/sql/docs/postgres/connect-run) helpful as those docs may be updated more frequently than this document. The official docs are not specific to `@database/pg` though.

Before you can connect, you will need to:

- Make sure that the instance created earlier has a public IP address. . You can verify this on the **Overview** page for your instance in the [Google Cloud Console](https://console.cloud.google.com/sql). If you need to add one, see the [Configuring public IP page](https://cloud.google.com/sql/docs/postgres/configure-ip) for instructions.
- Get the `$INSTANCE_CONNECTION_NAME` for your instance. This can be found on the Overview page for your instance in the Google Cloud Console. or by running the following command: `gcloud sql instances describe $INSTANCE_NAME`.
- Configure the service account for your service. Make sure that the service account has the appropriate Cloud SQL roles and permissions to connect to Cloud SQL. The service account for your service needs the `Cloud SQL Client` role.
- Make sure you know the `$DB_USER`, `$DB_PASSWORD` and `$DB_NAME` name you want to connect to.

The database password should be stored in [Google Secret Manager](https://cloud.google.com/secret-manager). Create a new secret to store the value of `$DB_PASSWORD` and note the `$DB_PASSWORD_SECRET_NAME`.

To configure your cloud run service to connect to the Postgres database, run:

```sh
gcloud run services update $SERVICE_NAME \
  --add-cloudsql-instances=$INSTANCE_CONNECTION_NAME \
  --update-env-vars=PGHOST=/cloudsql/$INSTANCE_CONNECTION_NAME \
  --update-env-vars=PGUSER=$DB_USER \
  --update-secrets=PGPASSWORD=$DB_PASSWORD_SECRET_NAME:latest \
  --update-env-vars=PGDATABASE=$DB_NAME
```

You can then connect using the following and @databases will automatically detect the config from your environment variables:

```typescript
import createConnectionPool from '@databases/pg';

const db = createConnectionPool();
```

```javascript
const createConnectionPool = require('@databases/pg');

const db = createConnectionPool();
```

If you prefer to use custom environment variable names, you can also manually specify all the connection parameters:

```typescript
import createConnectionPool from '@databases/pg';

const db = createConnectionPool({
  user: process.env.DB_USER, // e.g. 'my-user'
  password: process.env.DB_PASS, // e.g. 'my-user-password'
  database: process.env.DB_NAME, // e.g. 'my-database'
  host: `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`,
});
```

```javascript
const createConnectionPool = require('@databases/pg');

const db = createConnectionPool({
  user: process.env.DB_USER, // e.g. 'my-user'
  password: process.env.DB_PASS, // e.g. 'my-user-password'
  database: process.env.DB_NAME, // e.g. 'my-database'
  host: `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`,
});
```
