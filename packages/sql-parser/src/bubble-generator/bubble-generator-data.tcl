
# This file contains the data used by the three syntax diagram rendering
# programs:
#
#   bubble-generator.tcl
#   bubble-generator-bnf.tcl
#   bubble-generator-bnf.tcl
#

# Graphs:
#
set all_graphs {
  sql-stmt-list {
    toploop {optx sql-stmt} ;
  }
  sql-stmt {
    line
      {opt EXPLAIN {opt QUERY PLAN}}
      {or
         alter-table-stmt
         analyze-stmt
         attach-stmt
         begin-stmt
         commit-stmt
         create-index-stmt
         create-table-stmt
         create-trigger-stmt
         create-view-stmt
         create-virtual-table-stmt
         delete-stmt
         delete-stmt-limited
         detach-stmt
         drop-index-stmt
         drop-table-stmt
         drop-trigger-stmt
         drop-view-stmt
         insert-stmt
         pragma-stmt
         reindex-stmt
         release-stmt
         rollback-stmt
         savepoint-stmt
         select-stmt
         update-stmt
         update-stmt-limited
         vacuum-stmt
      }
  }
  alter-table-stmt {
    rightstack
       {line ALTER TABLE {optx /schema-name .} /table-name}
       {tailbranch
          {line RENAME TO /new-table-name}
          {line RENAME {optx COLUMN} /column-name TO /new-column-name}
          {line ADD {optx COLUMN} column-def}
       }
  }
  analyze-stmt {
     line ANALYZE {or nil /schema-name /table-or-index-name
                    {line /schema-name . /table-or-index-name}}
  }
  attach-stmt {
     line ATTACH {or DATABASE nil} expr AS /schema-name
  }
  begin-stmt {
     line BEGIN {or nil DEFERRED IMMEDIATE EXCLUSIVE}
          {optx TRANSACTION}
  }
  commit-stmt {
     line {or COMMIT END} {optx TRANSACTION}
  }
  rollback-stmt {
     line ROLLBACK {optx TRANSACTION}
        {optx TO {optx SAVEPOINT} /savepoint-name}
  }
  savepoint-stmt {
     line SAVEPOINT /savepoint-name
  }
  release-stmt {
     line RELEASE {optx SAVEPOINT} /savepoint-name
  }
  create-index-stmt {
    rightstack
       {line CREATE {opt UNIQUE} INDEX {opt IF NOT EXISTS}}
       {line {optx /schema-name .} /index-name
             ON /table-name ( {loop indexed-column ,} )}
       {line {opt WHERE expr}}
  }
  indexed-column {
      line {or /column-name expr } {opt COLLATE /collation-name} {or nil ASC DESC} 
  }
  create-table-stmt {
    stack
       {line CREATE {or {} TEMP TEMPORARY} TABLE {opt IF NOT EXISTS}}
       {line {optx /schema-name .} /table-name}
       {or {line ( {loop column-def ,} {loop {} {, table-constraint}} )
                  {opt WITHOUT ROWID}}
           {line AS select-stmt}
       }
  }
  column-def {
    line /column-name {or type-name nil} {loop nil {nil column-constraint nil}}
  }
  type-name {
     line {loop /name {}} {or {}
        {line ( signed-number )}
        {line ( signed-number , signed-number )}
     }
  }
  column-constraint {
    stack
      {optx CONSTRAINT /name}
      {or
         {line PRIMARY KEY {or nil ASC DESC} 
               conflict-clause {opt AUTOINCREMENT}
         }
         {line NOT NULL conflict-clause}
         {line UNIQUE conflict-clause}
         {line CHECK ( expr )}
         {line DEFAULT 
            {or
                signed-number
                literal-value
                {line ( expr )}
            }
         }
         {line COLLATE /collation-name}
         {line foreign-key-clause}
      }
  }
  signed-number {
     line {or nil + -} /numeric-literal
  }
  table-constraint {
     stack
       {optx CONSTRAINT /name}
       {or
          {line {or {line PRIMARY KEY} UNIQUE}
                ( {loop indexed-column ,} ) conflict-clause}
          {line CHECK ( expr )}
          {line FOREIGN KEY ( {loop /column-name ,} ) foreign-key-clause }
       }
  }
  foreign-key-clause {
      stack 
        {line REFERENCES /foreign-table {optx ( {loop /column-name ,} )}}
        {optx 
          {loop
             {or 
                {line ON {or DELETE UPDATE}
                         {or {line SET NULL} {line SET DEFAULT}
                             CASCADE RESTRICT {line NO ACTION}
                         }
                }
                {line MATCH /name}
             }
             {}
          }
        }
        {optx
          {line {optx NOT} DEFERRABLE 
             {or 
                {line INITIALLY DEFERRED}
                {line INITIALLY IMMEDIATE}
                {}
             }
          }
          nil
        }
  }
  conflict-clause {
    opt {line ON CONFLICT {or ROLLBACK ABORT FAIL IGNORE REPLACE}}
  }
  create-trigger-stmt {
    stack
       {line CREATE {or {} TEMP TEMPORARY} TRIGGER {opt IF NOT EXISTS}}
       {line {optx /schema-name .} /trigger-name
             {or BEFORE AFTER {line INSTEAD OF} nil}
       }
       {line
             {or DELETE INSERT 
                 {line UPDATE {opt OF {loop /column-name ,} }}
             }
             ON /table-name
       }
       {line {optx FOR EACH ROW}
             {optx WHEN expr}
       }
       {line BEGIN
             {loop 
                {line {or update-stmt insert-stmt delete-stmt select-stmt} ;} 
                nil
             }
             END
       }
  }
  create-view-stmt {
    stack
       {line CREATE {or {} TEMP TEMPORARY} VIEW {opt IF NOT EXISTS}}
       {line {opt /schema-name .} /view-name {opt ( {loop /column-name ,} )}
             AS select-stmt}
  }
  create-virtual-table-stmt {
    stack
       {line CREATE VIRTUAL TABLE {opt IF NOT EXISTS}}
       {line {optx /schema-name .} /table-name}
       {line USING /module-name {optx ( {loop /module-argument ,} )}}
  }
  with-clause {
    line
      WITH {opt RECURSIVE} {loop {line cte-table-name AS ( select-stmt )} ,}
  }
  cte-table-name {
    line /table-name {optx ( {loop /column-name ,} )}
  }
  recursive-cte {
    line cte-table-name AS 
       ( /initial-select {or UNION {line UNION ALL}} /recursive-select )
  }
  common-table-expression {
    line  /table-name {optx ( {loop /column-name ,} )} AS ( select-stmt )
  }
  delete-stmt {
    stack
      {line {opt with-clause} DELETE FROM qualified-table-name}
      {optx WHERE expr}
  }
  delete-stmt-limited {
    stack
        {line {opt with-clause} DELETE FROM qualified-table-name}
        {optx WHERE expr}
        {optx
            {stack
              {optx ORDER BY {loop ordering-term ,}}
              {line LIMIT expr {optx {or OFFSET ,} expr}}
            }
        }
  }
  detach-stmt {
    line DETACH {optx DATABASE} /schema-name
  }
  drop-index-stmt {
    line DROP INDEX {optx IF EXISTS} {optx /schema-name .} /index-name
  }
  drop-table-stmt {
    line DROP TABLE {optx IF EXISTS} {optx /schema-name .} /table-name
  }
  drop-trigger-stmt {
    line DROP TRIGGER {optx IF EXISTS} {optx /schema-name .} /trigger-name
  }
  drop-view-stmt {
    line DROP VIEW {optx IF EXISTS} {optx /schema-name .} /view-name
  }
  expr {
    or
     {line literal-value}
     {line bind-parameter}
     {line {optx {optx /schema-name .} /table-name .} /column-name}
     {line /unary-operator expr}
     {line expr /binary-operator expr}
     {line /function-name ( {or {line {optx DISTINCT} {toploop expr ,}} {} *} )}
     {line ( {toploop expr ,} )}
     {line CAST ( expr AS type-name )}
     {line expr COLLATE /collation-name}
     {line expr {optx NOT} {or LIKE GLOB REGEXP MATCH} expr
           {opt ESCAPE expr}}
     {line expr {or ISNULL NOTNULL {line NOT NULL}}}
     {line expr IS {optx NOT} expr}
     {line expr {optx NOT} BETWEEN expr AND expr}
     {line expr {optx NOT} IN 
            {or
               {line ( {or {} select-stmt {loop expr ,}} )}
               {line {optx /schema-name .} /table-name}
               {line {optx /schema-name .} /table-function
                         ( {or {toploop expr ,} {}} ) }
            }
     }
     {line {optx {optx NOT} EXISTS} ( select-stmt )}
     {line CASE {optx expr} {loop {line WHEN expr THEN expr} {}}
           {optx ELSE expr} END}
     {line raise-function}
     {line /window-func ( {or {line {toploop expr ,}} {} *} ) 
           {opt filter} OVER {or window-defn /window-name}}
  }
  raise-function {
     line RAISE ( 
           {or IGNORE
               {line {or ROLLBACK ABORT FAIL} , /error-message }
           } )
  }
  literal-value {
    or
     {line /numeric-literal}
     {line /string-literal}
     {line /blob-literal}
     {line NULL}
     {line TRUE}
     {line FALSE}
     {line CURRENT_TIME}
     {line CURRENT_DATE}
     {line CURRENT_TIMESTAMP}
  }
  numeric-literal {
    or
     {line {or
              {line {loop /digit nil} {opt /decimal-point {loop nil /digit}}}
              {line /decimal-point {loop /digit nil}}
           }
           {opt E {or nil + -} {loop /digit nil}}}
     {line \"0x\" {loop /hexdigit nil}}
  }
  insert-stmt {
    stack
       {line {opt with-clause}
          {or 
              INSERT
              REPLACE
              {line INSERT OR REPLACE}
              {line INSERT OR ROLLBACK}
              {line INSERT OR ABORT}
              {line INSERT OR FAIL}
              {line INSERT OR IGNORE}
          }
          INTO
       }
       {line {optx /schema-name .} /table-name
             {opt AS /alias}
             {optx ( {loop /column-name ,} )}}
       {line {or
           {line VALUES {loop {line ( {loop expr ,} )} ,}}
           select-stmt
           {line DEFAULT VALUES}
         } {opt upsert-clause}}
  }
  upsert-clause {
    stack
      {line ON CONFLICT {opt ( {loop indexed-column ,} ) {opt WHERE expr} } DO } 
      {or
         NOTHING
         {line UPDATE SET 
              {loop {line {or /column-name column-name-list} = expr} ,}
              {optx WHERE expr}}
      }
  }
  pragma-stmt {
     line PRAGMA {optx /schema-name .} /pragma-name
          {or
              nil
              {line = pragma-value}
              {line ( pragma-value )}
          }
  }
  pragma-value {
     or
        signed-number
        /name
        /string-literal
  }
  reindex-stmt {
     line REINDEX
          {tailbranch nil
             /collation-name
             {line {optx /schema-name .}
                 {tailbranch /table-name /index-name}
             }
          }
  }
  select-stmt {
   stack
     {opt {line WITH {opt RECURSIVE} {loop common-table-expression ,}}}
     {loop 
       {or
          {indentstack 2
              {line SELECT {or nil DISTINCT ALL}
                                             {loop result-column ,}}
              {optx FROM {or {loop table-or-subquery ,} join-clause}}
              {optx WHERE expr}
              {optx GROUP BY {loop expr ,} {optx HAVING expr}}
              {optx WINDOW {loop {line /window-name AS window-defn} ,}}
          }
          {line VALUES {loop {line ( {toploop expr ,} )} ,}}
       }
       compound-operator
     }
     {optx ORDER BY {loop ordering-term ,}}
     {optx LIMIT expr {optx {or OFFSET ,} expr}}
  }
  join-clause {
    line
      table-or-subquery
      {opt {loop {line join-operator table-or-subquery join-constraint}}}
  }
  select-core {
     or
        {indentstack 2
            {line SELECT {or nil DISTINCT ALL}
                                           {loop result-column ,}}
            {optx FROM {or {loop table-or-subquery ,} join-clause}}
            {optx WHERE expr}
            {optx GROUP BY {loop expr ,} {optx HAVING expr}}
            {optx WINDOW {loop {line /window-name AS window-defn} ,}}
        }
        {line VALUES {loop {line ( {toploop expr ,} )} ,}}
  }
  factored-select-stmt {
    stack
      {opt {line WITH {opt RECURSIVE} {loop common-table-expression ,}}}
      {line {loop select-core compound-operator}}
      {optx ORDER BY {loop ordering-term ,}}
      {optx LIMIT expr {optx {or OFFSET ,} expr}}
  }
  simple-select-stmt {
    stack
      {opt {line WITH {opt RECURSIVE} {loop common-table-expression ,}}}
      {line select-core {stack
                           {optx ORDER BY {loop ordering-term ,}}
                           {optx LIMIT expr {optx {or OFFSET ,} expr}}}}
  }
  compound-select-stmt {
    stack
      {opt {line WITH {opt RECURSIVE} {loop common-table-expression ,}}}
      {line select-core {loop
                    {line {or UNION {line UNION ALL} INTERSECT EXCEPT}
                          select-core} nil}}
      {optx ORDER BY {loop ordering-term ,}}
      {optx LIMIT expr {optx {or OFFSET ,} expr}}
  }
  table-or-subquery {
     or
       {stack
          {line
             {opt /schema-name .} /table-name
          }
          {line
            {opt {optx AS} /table-alias}
            {or nil {line INDEXED BY /index-name} {line NOT INDEXED}}
          }
       }
       {rightstack
          {line
             {opt /schema-name .} /table-function-name
             ( {or {toploop expr ,} {}} )
          }
          {line
            {opt {optx AS} /table-alias}
          }
       }
       {line ( {or {loop table-or-subquery ,} join-clause} )}
       {line
          ( select-stmt ) {opt {optx AS} /table-alias}
       }
  }
  result-column {
     or
        {line expr {opt {optx AS} /column-alias}}
        *
        {line /table-name . *}
  }
  join-operator {
     or
        {line ,}
        {line
            {opt NATURAL}
            {or  nil {line LEFT {or OUTER nil}} INNER CROSS}
            JOIN
        }
  }
  join-constraint {
     or
        {line ON expr}
        {line USING ( {loop /column-name ,} )}
        nil
  }
  ordering-term {
      line expr {opt COLLATE /collation-name} {or nil ASC DESC} 
  }
  compound-operator {
     or UNION {line UNION ALL} INTERSECT EXCEPT
  }
  update-stmt {
     rightstack
        {line {opt with-clause} UPDATE {or {} {line OR ROLLBACK}
                                     {line OR ABORT}
                                     {line OR REPLACE}
                                     {line OR FAIL}
                                     {line OR IGNORE}}
              qualified-table-name}
        {line SET {loop {line {or /column-name column-name-list} = expr} ,}
              {optx WHERE expr}}
  }
  column-name-list {line ( {loop /column-name ,} )}
  update-stmt-limited {
     stack
        {line {opt with-clause} UPDATE {or {} {line OR ROLLBACK}
                                     {line OR ABORT}
                                     {line OR REPLACE}
                                     {line OR FAIL}
                                     {line OR IGNORE}}
              qualified-table-name}
        {line SET {loop {line {or /column-name column-name-list} = expr} ,}
                  {optx WHERE expr}}
        {optx
            {stack
              {optx ORDER BY {loop ordering-term ,}}
              {line LIMIT expr {optx {or OFFSET ,} expr}}
            }
        }
  }
  qualified-table-name {
     stack
       {line {optx /schema-name .} /table-name {opt AS /alias}}
       {or nil {line INDEXED BY /index-name} {line NOT INDEXED}}
  }
  vacuum-stmt {
      line VACUUM {opt /schema-name} {opt INTO /filename}
  }
  comment-syntax {
    or
      {line -- {loop nil /anything-except-newline} 
           {or /newline /end-of-input}}
      {line /* {loop nil /anything-except-*/}
           {or */ /end-of-input}}
  }
  filter {
    line FILTER ( WHERE expr )
  }
  window-defn {
    stack {line ( {opt /base-window-name} {opt PARTITION BY {loop expr ,}}}
          {opt ORDER BY {loop ordering-term ,}}
          {line {optx frame-spec} )}
  }
  frame-spec {
    stack {
      line {or RANGE ROWS GROUPS} {or
         {line BETWEEN {or {line UNBOUNDED PRECEDING}
                           {line expr PRECEDING}
                           {line CURRENT ROW}
                           {line expr FOLLOWING}
                       }
               AND {or     {line expr PRECEDING}
                           {line CURRENT ROW}
                           {line expr FOLLOWING}
                           {line UNBOUNDED FOLLOWING}
                   }
         }
         {or   {line UNBOUNDED PRECEDING}
               {line expr PRECEDING}
               {line CURRENT ROW}
         }
      }
    } {
      line {or nil
         {line EXCLUDE NO OTHERS} 
         {line EXCLUDE CURRENT ROW} 
         {line EXCLUDE GROUP} 
         {line EXCLUDE TIES} 
      }
    }
  }
  function-invocation {
     line /function-name ( {or {line {optx DISTINCT} {toploop expr ,}} {} *} )
  }
  window-function-invocation {
    line /window-func ( {or {line {toploop expr ,}} {} *} ) 
         {opt filter} OVER {or window-defn /window-name}
  }
}
