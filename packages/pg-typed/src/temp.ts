import {q, Table} from './v2';

export {};

interface User {
  id: number;
  username: string;
}
interface Post {
  author_id: number;
  title: string;
  created_at: Date;
}

declare const users: Table<User>;
declare const posts: Table<Post>;

// users.select(`id`, `username`).all();
// const join = users
//   .as(`u`)
//   .innerJoin(posts.as(`p`))
//   .on((c) => op.eq(c(`u.id`), c(`p.author_id`)))
//   .select((c) => ({
//     id: c(`u.id`),
//     username: c(`u.username`),
//     title: c(`p.title`),
//   }));
const join = users
  .as(`u`)
  .where((u) => q.eq(u.id, 10))
  .innerJoin(posts.as(`p`))
  .on(({u, p}) => q.eq(u.id, p.author_id))
  .select(({u, p}) => ({
    id: u.id,
    username: u.username,
    title: p.title,
  }));

// const result = users
//   .as(`u`)
//   .innerJoin(posts.as(`p`))
//   .on((c) => op.eq(c(`u.id`), c(`p.author_id`)))
//   .selectGroupBy(
//     ({u}) => ({
//       id: u.id,
//       username: u.use,
//     }),
//     (c) => ({
//       last_posted_at: op.max(c(`p.created_at`)),
//     }),
//   )
//   .orderByDesc(`last_posted_at`)
//   .all();

const result2 = users
  .as(`u`)
  .innerJoin(posts.as(`p`))
  .on(({u, p}) => q.eq(u.id, p.author_id))
  .groupBy(({u}) => ({
    id: u.id,
    username: u.username,
  }))
  .selectAggregate(({p}) => ({
    last_posted_at: q.max(p.created_at),
  }))
  .orderByDesc(`last_posted_at`)
  .all();

const lastPostedAt = posts.as(`p`).selectAggregate(({p}) => ({
  last_posted_at: q.max(p.created_at),
}));

// SELECT u.id, u.username, MAX(p.created_at) AS last_posted_at
// FROM users AS u
// INNER JOIN posts AS p ON u.id=p.author_id
// GROUP BY u.id, u.username;

interface BaseQuery<TRecord> {
  select<TColumns extends SelectionSet<TRecord>>(
    columns: TColumns,
  ): FinishedQuery<SelectionSetResult<TRecord, TColumns>>;
  where(query: Partial<TRecord>): BaseQuery<TRecord>;
}

// interface SelectQuery<TRecord> {
//   // as<TAliasTableName extends string>(
//   //   alias: TAliasTableName,
//   // ): AliasedQuery<{
//   //   [TKey in `${TAliasTableName}.${string &
//   //     keyof TRecord}`]: TKey extends `${TAliasTableName}.${infer TColumn}`
//   //     ? TColumn extends keyof TRecord
//   //       ? TRecord[TColumn]
//   //       : never
//   //     : never;
//   // }>;
//   as<TAliasTableName extends string>(
//     alias: TAliasTableName,
//   ): AliasedQuery<{[TKey in TAliasTableName]: TRecord}>;
//   select<TColumnNames extends (keyof TRecord)[]>(
//     ...columnNames: TColumnNames
//   ): FinishedQuery<Pick<TRecord, TColumnNames[number]>>;
//   select<TColumns extends SelectionSet<TRecord>>(
//     columns: TColumns,
//   ): FinishedQuery<SelectionSetResult<TRecord, TColumns>>;
// }

// interface Table<TRecord> extends SelectQuery<TRecord> {
//   find(where?: Partial<TRecord>): SelectQuery<TRecord>;
// }

interface FinishedQuery<TRecord> {
  all(): Promise<TRecord[]>;
}

interface SelectionSet<TRecord> {
  [k: string]:
    | keyof TRecord
    | `${`MAX` | `MIN` | `SUM`}(${string & keyof TRecord})`
    | `COUNT(*)`;
}
type SelectionSetResult<
  TRecord,
  TSelectionSet extends SelectionSet<TRecord>,
> = {
  [TAliasName in keyof TSelectionSet]: TSelectionSet[TAliasName] extends `COUNT(*)`
    ? number
    : TSelectionSet[TAliasName] extends `${
        | `MAX`
        | `MIN`
        | `SUM`}(${infer TColumnName})`
    ? TColumnName extends keyof TRecord
      ? TRecord[TColumnName]
      : never
    : TSelectionSet[TAliasName] extends keyof TRecord
    ? TRecord[TSelectionSet[TAliasName]]
    : never;
};

// interface JoinedQuery<TRecord> {}

// declare function innerJoin<
//   TLeftName extends string,
//   TLeftRecord,
//   TRightName extends string,
//   TRightRecord,
// >(
//   left: SelectQuery<TLeftName, TLeftRecord>,
//   right: SelectQuery<TRightName, TRightRecord>,
// ): {
//   on(where: {
//     [key in `${TLeftName}.${string &
//       keyof TLeftRecord}`]?: `${TRightName}.${string & keyof TRightRecord}`;
//   }): {
//     select<
//       TColumns extends {
//         [k: string]:
//           | `${TLeftName}.${string & keyof TLeftRecord}`
//           | `${TRightName}.${string & keyof TRightRecord}`;
//       },
//     >(
//       columns: TColumns,
//     ): {
//       [TAliasName in keyof TColumns]: TColumns[TAliasName] extends `${infer TTableName}.${infer TColumnName}`
//         ? TTableName extends TLeftName
//           ? TColumnName extends keyof TLeftRecord
//             ? TLeftRecord[TColumnName]
//             : unknown
//           : TTableName extends TRightName
//           ? TColumnName extends keyof TRightRecord
//             ? TRightRecord[TColumnName]
//             : unknown
//           : unknown
//         : unknown;
//     };
//   };
// };

// innerJoin(users.find().as(`u`), posts.find().as(`p`))
//   .on({
//     'u.id': 'p.author_id',
//   })
//   .select({
//     user_id: `u.id`,
//     post_title: `p.title`,
//   });
// const res = users.find().select({name: `username`}).as(`u`);
// //(posts.find().as('p')).select('u.id', 'p.title');

// declare function innerJoinMany<
//   TParts extends {[alias: string]: SelectQuery<any, any>},
// >(
//   parts: TParts,
// ): {
//   on(): {
//     select<
//       TColumns extends {
//         [k: string]: {
//           [TTableName in keyof TParts]: `${string &
//             TTableName}.${TParts[TTableName] extends SelectQuery<
//             any,
//             infer TRecord
//           >
//             ? keyof TRecord
//             : never}`;
//         }[keyof TParts];
//       },
//     >(
//       columns: TColumns,
//     ): {
//       [TAliasName in keyof TColumns]: TColumns[TAliasName] extends `${infer TTableName}.${infer TColumnName}`
//         ? TTableName extends TLeftName
//           ? TColumnName extends keyof TLeftRecord
//             ? TLeftRecord[TColumnName]
//             : unknown
//           : TTableName extends TRightName
//           ? TColumnName extends keyof TRightRecord
//             ? TRightRecord[TColumnName]
//             : unknown
//           : unknown
//         : unknown;
//     };
//   };
// };

// innerJoinMany({
//   u: users.find(),
//   p: posts.find(),
// })
//   .on()
//   .select({
//     username: `u.username`,
//     post_title: `p.title`,
//   });
