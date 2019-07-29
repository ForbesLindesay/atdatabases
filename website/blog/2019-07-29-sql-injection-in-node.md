---
title: SQL Injection in Node.js
author: Forbes Lindesay
authorURL: http://twitter.com/ForbesLindesay
authorTwitter: ForbesLindesay
---

SQL Injection remains one of the most prevalent and easily exploitable security vulnerabilities in modern web applications. It think a lot of that is that SQL libraries make it so easy to get this wrong, and it's not always obvious why it's such a big deal.

<!--truncate-->

# What's the big deal?

The problem with SQL is that it mixes code with data. Consider the following statement:

<!-- ```sql
INSERT INTO posts (body, username)
VALUES ("Hello World", "my_username")
``` -->

<pre><code class="hljs css language-sql"><span class="hljs-keyword">INSERT</span> <span class="hljs-keyword">INTO</span> posts (<span class="hljs-keyword">body</span>, username)
<span class="hljs-keyword">VALUES</span> (<span class="hljs-string">"<span style="background:yellow">Hello World</span>"</span>, <span class="hljs-string">"<span style="background:yellow">my_username</span>"</span>)
</code></pre>

The sections hightlighted in <span class="hljs-string" style="background:yellow">yellow</span> are data, but the rest of that SQL statement is code. If we try to make this part of some JavaScript we might want to take the body and username as parameters and do something like this:

<!-- ```js
function addPost(body, username) {
  return db.query(`
    INSERT INTO posts (body, username)
    VALUES ("${body}", "${username}")
  `);
}
``` -->

<pre><code class="hljs css language-js"><span class="hljs-function"><span class="hljs-keyword">function</span> <span class="hljs-title">addPost</span>(<span class="hljs-params">body, username</span>) </span>{
  <span class="hljs-keyword">return</span> db.query(<span class="hljs-string">`
    INSERT INTO posts (body, username)
    VALUES ("<span class="hljs-subst" style="background:yellow">${body}</span>", "<span class="hljs-subst" style="background:yellow">${username}</span>")
  `</span>);
}
</code></pre>

> N.B. this code is not secure in most database libraries and would therefore throw an exception in @databases

This code is invitingly simple, but consider a typical scenario:

- the body is provided by the user, who types their message into a text box.
- the username is provided by the server, based on some secure authentication, e.g. a username and password.

A malicious user might try to post the message:

```
I am stupid", "someone_else") --
```

This would result in the SQL

```sql
INSERT INTO posts (body, username)
VALUES ("I am stupid", "someone_else") --", "my_username")
```

This would insert the post "I am stupid" as if "someone_else" had said it, even though I should only be able to post as myself. To make it clearer what's going on, I've highlighted in <span class="hljs-string" style="background:yellow">yellow</span> the two variables that have been inserted into my SQL:

<pre><code class="hljs css language-sql"><span class="hljs-keyword">INSERT</span> <span class="hljs-keyword">INTO</span> posts (<span class="hljs-keyword">body</span>, username)
<span class="hljs-keyword">VALUES</span> (<span class="hljs-string">"<span style="background:yellow">I am stupid"</span></span><span style="background:yellow">, <span class="hljs-string">"someone_else"</span>) </span><span class="hljs-comment"><span style="background:yellow">--</span>", "<span style="background:yellow">my_username</span>")</span>
</code></pre>

# Separating Code From Data

If the problem is that SQL combines code with data, the solution is to separate the code from the data. To continue with the example from before, we could have written our JavaScript function as:

```js
function addPost(body, username) {
  return db.query(
    `
      INSERT INTO posts (body, username)
      VALUES (?, ?)
    `,
    [body, username],
  );
}
```

Here we've used a `?` as a placeholder in the code for "some data". The `?` is no longer in `"quotes"` as it is not the string literal `"?"`. If we were to pass it the same malicious input as before, the database engine would be passed the SQL string:

```sql
INSERT INTO posts (body, username)
VALUES (?, ?)
```

along with the values:

```js
['I am stupid", "someone_else") --', 'my_username'];
```

This is totally safe. If you can be disciplined about writing your queries this way, your code will be secure.

# Why @databases

There are a few downsides to the approach above that I wanted to fix with @databases:

1. It's easy to forget to do this, and accidentally use the insecure approach from time to time. This is especially true if you're new to writing server side JavaScript, or if you're working on a large team where it might not even be you who messes up.
2. It can be hard to review code and be **sure** this approach has been followed consistently. You might be constructing somewhat dynamic queries, where you're not always querying for the same list of fields. You have to read code very carefully to distinguish variables containing trusted strings, from variables containing user entered strings.
3. I find it harder to read/follow, especially when the query gets long/complex. The data can become very separated from the location in the query where it is used.

With @databases you can just write:

```js
function addPost(body, username) {
  return db.query(sql`
    INSERT INTO posts (body, username)
    VALUES ("${body}", "${username}")
  `);
}
```

The `sql` tag before the SQL query tells JavaScript to pass the literal strings separately from the values to the `sql` function, whichh can process them as needed. The `sql` function then returns the query and the values separately. In this example, the database gets passed the query:

```sql
INSERT INTO posts (body, username)
VALUES (?, ?)
```

along with the values for `body` and `username`. The great thing about using `@databases` consistently is that `@databases` will throw an exception if you try to pass it anything that's not been tagged as `sql` so you can't accidentally pass it a string (and neither can your team mates). If you're using TypeScript, you even get a type error at build time if you forget to tag your SQL statements. You can use `@databases` with Postgres, MySQL, SQLite and WebSQL.

# Alternatives

There are a couple of alternative approaches:

1. Using a query builder like "knex" that lets you safely construct SQL statements using a JavaScript API.
2. Using an ORM like Sequelize that maps your database into a native feeling JavaScript API.

These are a great option for accessing databases without risking SQL injection. If they work for you, please continue using them. The biggest problem with both of these is that they separate you from the actual SQL, which often means you miss opportunities to take advantage of the most useful/powerful features of databases, and can lead to much less efficient code. I've found that the more I actually use SQL directly, the less I dislike working with it.

> If you like working with node.js and databases, you could be perfect for a role as a [Senior JavaScript Full-Stack Developer](https://threadsstyling.workable.com/jobs/748730) at [Threads](https://www.threadsstyling.com/careers).
