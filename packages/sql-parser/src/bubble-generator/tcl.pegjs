FILE = (COMMENT / WHITESPACE)* stmt:SET (COMMENT/WHITESPACE)* {
  return stmt;
}

WHITESPACE "whitespace" = [ \n\t]+ {return null}

COMMENT "comment" = "#" value:[^\n]* "\n" {
  return {type: "COMMENT", value: value.join('')};
} 
SET = "set all_graphs {" elements:(WHITESPACE / ELEMENT)* "}" {
  const rules = {};
  elements.filter(e => e).forEach(rule => {
    rules[rule.name] = rule;
  });
  return {
    type: "ALL_GRAPHS",
    rules,
    // rest: rest.join('').substr(0, 50),
  }
}
UNKNOWN = .+ {return "UNKNOWN"}

ELEMENT "element" = name:WORD WHITESPACE body:GROUP {
  return {
    type: "ELEMENT",
    name,
    body,
  };
}

GROUP "group" = "{" WHITESPACE? name:WORD body:(WHITESPACE (GROUP / EMPTY_GROUP / WORD))* WHITESPACE? "}" {
  return {
    type: "GROUP",
    name,
    body: body.map(e => e[1]),
  };
}

EMPTY_GROUP "{}" = "{}" { return {type: "GROUP"} }

GROUP_NAME "name" = name:[a-z]+ {
  return name.join('');
}

WORD "word" = word:[^ \n\t\{\}]+{
  return word.join('');
}
