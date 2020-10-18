enum TypeKind {
  // N.B. Array is not really a type in postgres,
  // instead Array is just a special kind of base
  // type
  Array = 'array',
  Base = 'b',
  // (e.g., a table's row type)
  Composite = 'c',
  // domains alias other types, with optional constraints
  Domain = 'd',
  Enum = 'e',
  Pseudo = 'p',
}

export default TypeKind;
