---
title: Choosing a node.js database
author: Forbes Lindesay
authorURL: http://twitter.com/ForbesLindesay
authorTwitter: ForbesLindesay
---

One of the first things you'll need to do when starting most node projects is to chose a database and database library. You'll normally want to choose your database before you choose the library, but in the case of @databases, we support a few different databases, so you do have some leeway.

## SQL vs. NoSQL

In recent years, NoSQL databases have grown, and then somewhat declined in popularity. They often seem much easier to get started with than SQL databases because you don't need to learn any new language, and you don't need to define your schema up-front. They also promised (in theory) some improvements in scalability vs. more traditional SQL databases.

While there are some situations where the scalability part is relevant, you should keep in mind that Facebook stores the vast majority of its data in a few MySQL servers. Unless you are a very big tech company like Google or Facebook, it is likely that Postgres or MySQL will scale to meet your needs with no problems.

The idea that you can get away without thinking as carefully about your schema in NoSQL databases is also often flawed. You normally end up with just as rigid a schema definition, except nobody has written down what that schema is.

The point about learning SQL is valid, but you can get started without needing to learn very much, and it is an extremely useful skill to develop. If you must use a NoSQL database, MongoDB remains one of the most popular, but I hope you will at least try using an SQL database first.

## Choosing an SQL Database

SQL Server and Oracle are both used in many busnesses, but their licensing and pricing models make them difficult and expensive to deploy and manage, and they don't offer any real upsides over MySQL or Postgres, so I won't consider them in depth here.

### SQLite

SQLite is great if you need to store data in a small project that will run on people's own machines, rather than on a server. It's very portable, very lightweight, and runs within the node.js process itself. This is also great if you are building an Electron app.

It cannot be shared amongst multiple instances of your app, which makes it a poor choice for most server side applications.

If you decide to use SQLite, you should read [Getting started with SQLite and Node.js](https://www.atdatabases.org/docs/sqlite.html) next.

### MySQL

MySQL is widely used and deployed. It is easy to get hosted versions from any of the major cloud providers. If you're already using it, there's certainly no reason you should panic about that choice. I wouldn't choose MySQL for new projects though, because:

1. It suffers from serious issues when handling time zones & dates/timestamps.
1. It doesn't have a propper type for `BOOLEAN`, which leads to messy translation between `0`/`1` and `true`/`false`.
1. It also doesn't have nearly as good support for JSON as Postgres

If decide to use MySQL, you should read [Getting started with MySQL and Node.js](https://www.atdatabases.org/docs/mysql.html) next.

### Postgres

Postgres is one of the most fully featured databases, and has good handling of dates & times, as well as excellent support for storing and querying unstructured JSON when you need to.

If you decide to use Postgres, you should read [Getting started with Postgres and Node.js](https://www.atdatabases.org/docs/pg.html) next.
