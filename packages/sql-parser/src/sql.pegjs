SqlStmtList = __  head:SqlStmt __  tail:(";" __ SqlStmt __)* {
  return [head].concat(tail);
};

SqlStmt = explain:("EXPLAIN" __ ("QUERY" __ "PLAN" __)?)? stmt:(SelectStmt) {
  if (explain) {
    return {
      kind: 'ExplainStmt',
      stmt,
    };
  }
  return stmt;
}

// TODO: WITH RECURSIVE common-table-expression
// https://sqlite.org/syntaxdiagrams.html#factored-select-stmt

SelectStmt = SelectCore
SelectCore
  = "SELECT" __
    modifier:(m:("DISTINCT" / "ALL") __ {return m})?
    selectList:SelectList
    "FROM" __ fromList:FromList
// TODO: WHERE, GROUP, WINDOW

    {
      return {
        kind: 'Select',
        modifier,
        selectList,
        fromList,
      };
    }
  / "VALUES" head:ValueList tail:ValueList*
    {
      return {kind: 'Values', values: [head].concat(tail)}
    }

ValueList = "(" __ head:Expression __ tail:("," __ e:Expression __ {return e})* ")" {
  return {kind: "ValueList", values: [head].concat(tail)}
}


SelectList = head:ResultColumn __ tail:(ResultColumn __ "," __)* {
  return [head].concat(tail);
}

ResultColumn = AliasedExpression / "*" {return {kind: "all"}} / TableName __ "." __"*"

AliasedExpression = expression:Expression __ alias:("AS" __ ca:ColumnAlias __ {return ca})? {
  if (alias) return {kind: 'alias', expression, alias};
}

// TODO
Expression = Identifier

FromList = head:TableOrSubQuery __ tail:(operator:JoinOperator __ table:TableOrSubQuery constraint:JoinConstraint {return {kind: "Join", operator, table, constraint}})* {
  return [{kind: 'Join', operator: null, table: head, constraint: null}].concat(tail);
}

CompoundOperator = op:("UNION" __ "ALL" {return "UNION_ALL"} / "UNION" / "INTERSECT" "EXCEPT") {return {kind: "UnionOperator", op}}

JoinOperator
  = "," {return null}
  / natural:"NATURAL"? __
    mode:(
      "LEFT" __ outer:("OUTER" __)? {return outer ? "LeftOuterJoin" : "LeftJoin"}
      / "INNER" __ {return "InnerJoin"}
      / "CROSS" __ {return "CrossJoin"}
    )?
    "JOIN" {return {kind: "JoinOperator", natural: !natural, mode}}

JoinConstraint
  = "ON" __ expr:Expression {return {kind: "OnConstraint", expr}}
  / "USING" __ "(" __ head:ColumnName __ tail:("," __ c:ColumnName __ {return c})* ")" {return {kind: "UsingConstraint", columns: [head].concat(tail)}}

TableOrSubQuery = TableName

ColumnAlias "Column Alias" = Identifier
ColumnName "ColumnName" = Identifier
TableName "Table Name" = Identifier

Identifier "Identifier" = letters:([a-z]i)+ { return letters.join('') }

WhiteSpace "whitespace"
  = "\t"
  / "\v"
  / "\f"
  / " "
  / "\u00A0"
  / "\uFEFF"
  / Zs;

__ = (WhiteSpace)*

// Separator, Space
Zs = [\u0020\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]

