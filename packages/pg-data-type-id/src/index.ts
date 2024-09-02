// auto generated by test suite of pg-schema-introspect

enum PgDataTypeID {
  // === Array ===

  /**
   * Array<abstime>
   */
  _abstime = 1023,

  /**
   * Array<aclitem>
   */
  _aclitem = 1034,

  /**
   * Array<bit>
   */
  _bit = 1561,

  /**
   * Array<bool>
   */
  _bool = 1000,

  /**
   * Array<box>
   */
  _box = 1020,

  /**
   * Array<bpchar>
   */
  _bpchar = 1014,

  /**
   * Array<bytea>
   */
  _bytea = 1001,

  /**
   * Array<char>
   */
  _char = 1002,

  /**
   * Array<cid>
   */
  _cid = 1012,

  /**
   * Array<cidr>
   */
  _cidr = 651,

  /**
   * Array<circle>
   */
  _circle = 719,

  /**
   * Array<cstring>
   */
  _cstring = 1263,

  /**
   * Array<date>
   */
  _date = 1182,

  /**
   * Array<datemultirange>
   */
  _datemultirange = 6155,

  /**
   * Array<daterange>
   */
  _daterange = 3913,

  /**
   * Array<float4>
   */
  _float4 = 1021,

  /**
   * Array<float8>
   */
  _float8 = 1022,

  /**
   * Array<gtsvector>
   */
  _gtsvector = 3644,

  /**
   * Array<inet>
   */
  _inet = 1041,

  /**
   * Array<int2>
   */
  _int2 = 1005,

  /**
   * Array<int2vector>
   */
  _int2vector = 1006,

  /**
   * Array<int4>
   */
  _int4 = 1007,

  /**
   * Array<int4multirange>
   */
  _int4multirange = 6150,

  /**
   * Array<int4range>
   */
  _int4range = 3905,

  /**
   * Array<int8>
   */
  _int8 = 1016,

  /**
   * Array<int8multirange>
   */
  _int8multirange = 6157,

  /**
   * Array<int8range>
   */
  _int8range = 3927,

  /**
   * Array<interval>
   */
  _interval = 1187,

  /**
   * Array<json>
   */
  _json = 199,

  /**
   * Array<jsonb>
   */
  _jsonb = 3807,

  /**
   * Array<jsonpath>
   */
  _jsonpath = 4073,

  /**
   * Array<line>
   */
  _line = 629,

  /**
   * Array<lseg>
   */
  _lseg = 1018,

  /**
   * Array<macaddr>
   */
  _macaddr = 1040,

  /**
   * Array<macaddr8>
   */
  _macaddr8 = 775,

  /**
   * Array<money>
   */
  _money = 791,

  /**
   * Array<name>
   */
  _name = 1003,

  /**
   * Array<numeric>
   */
  _numeric = 1231,

  /**
   * Array<nummultirange>
   */
  _nummultirange = 6151,

  /**
   * Array<numrange>
   */
  _numrange = 3907,

  /**
   * Array<oid>
   */
  _oid = 1028,

  /**
   * Array<oidvector>
   */
  _oidvector = 1013,

  /**
   * Array<path>
   */
  _path = 1019,

  /**
   * Array<pg_attribute>
   */
  _pg_attribute = 270,

  /**
   * Array<pg_class>
   */
  _pg_class = 273,

  /**
   * Array<pg_ident_file_mappings>
   */
  _pg_ident_file_mappings = 12119,

  /**
   * Array<pg_lsn>
   */
  _pg_lsn = 3221,

  /**
   * Array<pg_parameter_acl>
   */
  _pg_parameter_acl = 10096,

  /**
   * Array<pg_proc>
   */
  _pg_proc = 272,

  /**
   * Array<pg_publication_namespace>
   */
  _pg_publication_namespace = 10108,

  /**
   * Array<pg_snapshot>
   */
  _pg_snapshot = 5039,

  /**
   * Array<pg_stat_io>
   */
  _pg_stat_io = 12294,

  /**
   * Array<pg_stat_recovery_prefetch>
   */
  _pg_stat_recovery_prefetch = 12241,

  /**
   * Array<pg_type>
   */
  _pg_type = 210,

  /**
   * Array<point>
   */
  _point = 1017,

  /**
   * Array<polygon>
   */
  _polygon = 1027,

  /**
   * Array<refcursor>
   */
  _refcursor = 2201,

  /**
   * Array<regclass>
   */
  _regclass = 2210,

  /**
   * Array<regcollation>
   */
  _regcollation = 4192,

  /**
   * Array<regconfig>
   */
  _regconfig = 3735,

  /**
   * Array<regdictionary>
   */
  _regdictionary = 3770,

  /**
   * Array<regnamespace>
   */
  _regnamespace = 4090,

  /**
   * Array<regoper>
   */
  _regoper = 2208,

  /**
   * Array<regoperator>
   */
  _regoperator = 2209,

  /**
   * Array<regproc>
   */
  _regproc = 1008,

  /**
   * Array<regprocedure>
   */
  _regprocedure = 2207,

  /**
   * Array<regrole>
   */
  _regrole = 4097,

  /**
   * Array<regtype>
   */
  _regtype = 2211,

  /**
   * Array<reltime>
   */
  _reltime = 1024,

  /**
   * Array<text>
   */
  _text = 1009,

  /**
   * Array<tid>
   */
  _tid = 1010,

  /**
   * Array<time>
   */
  _time = 1183,

  /**
   * Array<timestamp>
   */
  _timestamp = 1115,

  /**
   * Array<timestamptz>
   */
  _timestamptz = 1185,

  /**
   * Array<timetz>
   */
  _timetz = 1270,

  /**
   * Array<tinterval>
   */
  _tinterval = 1025,

  /**
   * Array<tsmultirange>
   */
  _tsmultirange = 6152,

  /**
   * Array<tsquery>
   */
  _tsquery = 3645,

  /**
   * Array<tsrange>
   */
  _tsrange = 3909,

  /**
   * Array<tstzmultirange>
   */
  _tstzmultirange = 6153,

  /**
   * Array<tstzrange>
   */
  _tstzrange = 3911,

  /**
   * Array<tsvector>
   */
  _tsvector = 3643,

  /**
   * Array<txid_snapshot>
   */
  _txid_snapshot = 2949,

  /**
   * Array<uuid>
   */
  _uuid = 2951,

  /**
   * Array<varbit>
   */
  _varbit = 1563,

  /**
   * Array<varchar>
   */
  _varchar = 1015,

  /**
   * Array<xid>
   */
  _xid = 1011,

  /**
   * Array<xid8>
   */
  _xid8 = 271,

  /**
   * Array<xml>
   */
  _xml = 143,

  /**
   * array of int2, used in system tables
   *
   * Array<int2>
   */
  int2vector = 22,

  /**
   * array of oids, used in system tables
   *
   * Array<oid>
   */
  oidvector = 30,

  // === PseudoTypes ===

  _record = 2287,

  /**
   * pseudo-type representing any type
   */
  any = 2276,

  /**
   * pseudo-type representing a polymorphic array type
   */
  anyarray = 2277,

  /**
   * pseudo-type representing a polymorphic common type
   */
  anycompatible = 5077,

  /**
   * pseudo-type representing an array of polymorphic common type elements
   */
  anycompatiblearray = 5078,

  /**
   * pseudo-type representing a multirange over a polymorphic common type
   */
  anycompatiblemultirange = 4538,

  /**
   * pseudo-type representing a polymorphic common type that is not an array
   */
  anycompatiblenonarray = 5079,

  /**
   * pseudo-type representing a range over a polymorphic common type
   */
  anycompatiblerange = 5080,

  /**
   * pseudo-type representing a polymorphic base type
   */
  anyelement = 2283,

  /**
   * pseudo-type representing a polymorphic base type that is an enum
   */
  anyenum = 3500,

  /**
   * pseudo-type representing a polymorphic base type that is a multirange
   */
  anymultirange = 4537,

  /**
   * pseudo-type representing a polymorphic base type that is not an array
   */
  anynonarray = 2776,

  /**
   * pseudo-type representing a range over a polymorphic base type
   */
  anyrange = 3831,

  /**
   * C-style string
   */
  cstring = 2275,

  /**
   * pseudo-type for the result of an event trigger function
   */
  event_trigger = 3838,

  /**
   * pseudo-type for the result of an FDW handler function
   */
  fdw_handler = 3115,

  /**
   * pseudo-type for the result of an index AM handler function
   */
  index_am_handler = 325,

  /**
   * pseudo-type representing an internal data structure
   */
  internal = 2281,

  /**
   * pseudo-type for the result of a language handler function
   */
  language_handler = 2280,

  /**
   * obsolete, deprecated pseudo-type
   */
  opaque = 2282,

  /**
   * internal type for passing CollectedCommand
   */
  pg_ddl_command = 32,

  /**
   * pseudo-type representing any composite type
   */
  record = 2249,

  table_am_handler = 269,

  /**
   * pseudo-type for the result of a trigger function
   */
  trigger = 2279,

  /**
   * pseudo-type for the result of a tablesample method function
   */
  tsm_handler = 3310,

  /**
   * pseudo-type for the result of a function with no real result
   */
  void = 2278,

  // === DateTime ===

  /**
   * absolute, limited-range date and time (Unix system time)
   */
  abstime = 702,

  /**
   * date
   */
  date = 1082,

  /**
   * time of day
   */
  time = 1083,

  /**
   * date and time
   */
  timestamp = 1114,

  /**
   * date and time with time zone
   */
  timestamptz = 1184,

  /**
   * time of day with time zone
   */
  timetz = 1266,

  // === UserDefined ===

  /**
   * access control list
   */
  aclitem = 1033,

  /**
   * variable-length string, binary values escaped
   */
  bytea = 17,

  /**
   * command identifier type, sequence in transaction id
   */
  cid = 29,

  /**
   * GiST index internal text representation for text search
   */
  gtsvector = 3642,

  /**
   * JSON stored as text
   */
  json = 114,

  /**
   * Binary JSON
   */
  jsonb = 3802,

  /**
   * JSON path
   */
  jsonpath = 4072,

  /**
   * XX:XX:XX:XX:XX:XX, MAC address
   */
  macaddr = 829,

  /**
   * XX:XX:XX:XX:XX:XX:XX:XX, MAC address
   */
  macaddr8 = 774,

  /**
   * PostgreSQL LSN datatype
   */
  pg_lsn = 3220,

  /**
   * snapshot
   */
  pg_snapshot = 5038,

  /**
   * reference to cursor (portal name)
   */
  refcursor = 1790,

  /**
   * storage manager
   */
  smgr = 210,

  /**
   * (block, offset), physical location of tuple
   */
  tid = 27,

  /**
   * query representation for text search
   */
  tsquery = 3615,

  /**
   * text representation for text search
   */
  tsvector = 3614,

  /**
   * txid snapshot
   */
  txid_snapshot = 2970,

  /**
   * UUID datatype
   */
  uuid = 2950,

  /**
   * transaction id
   */
  xid = 28,

  /**
   * full transaction id
   */
  xid8 = 5069,

  /**
   * XML content
   */
  xml = 142,

  // === BitString ===

  /**
   * fixed-length bit string
   */
  bit = 1560,

  /**
   * variable-length bit string
   */
  varbit = 1562,

  // === Boolean ===

  /**
   * boolean, 'true'/'false'
   */
  bool = 16,

  // === Geometric ===

  /**
   * geometric box '(lower left,upper right)'
   */
  box = 603,

  /**
   * geometric circle '(center,radius)'
   */
  circle = 718,

  /**
   * geometric line
   */
  line = 628,

  /**
   * geometric line segment '(pt1,pt2)'
   */
  lseg = 601,

  /**
   * geometric path '(pt1,...)'
   */
  path = 602,

  /**
   * geometric point '(x, y)'
   */
  point = 600,

  /**
   * geometric polygon '(pt1,...)'
   */
  polygon = 604,

  // === String ===

  /**
   * char(length), blank-padded string, fixed storage length
   */
  bpchar = 1042,

  /**
   * 63-byte type for storing system identifiers
   */
  name = 19,

  /**
   * variable-length string, no limit specified
   */
  text = 25,

  /**
   * varchar(length), non-blank-padded string, variable storage length
   */
  varchar = 1043,

  // === undefined ===

  /**
   * single character
   */
  char = 18,

  /**
   * BRIN bloom summary
   */
  pg_brin_bloom_summary = 4600,

  /**
   * BRIN minmax-multi summary
   */
  pg_brin_minmax_multi_summary = 4601,

  /**
   * multivariate dependencies
   */
  pg_dependencies = 3402,

  /**
   * multivariate MCV list
   */
  pg_mcv_list = 5017,

  /**
   * multivariate ndistinct coefficients
   */
  pg_ndistinct = 3361,

  /**
   * string representing an internal node tree
   */
  pg_node_tree = 194,

  // === NetworkAddress ===

  /**
   * network IP address/netmask, network address
   */
  cidr = 650,

  /**
   * IP address/netmask, host address, netmask optional
   */
  inet = 869,

  // === Range ===

  /**
   * multirange of dates
   */
  datemultirange = 4535,

  /**
   * range of dates
   */
  daterange = 3912,

  /**
   * multirange of integers
   */
  int4multirange = 4451,

  /**
   * range of integers
   */
  int4range = 3904,

  /**
   * multirange of bigints
   */
  int8multirange = 4536,

  /**
   * range of bigints
   */
  int8range = 3926,

  /**
   * multirange of numerics
   */
  nummultirange = 4532,

  /**
   * range of numerics
   */
  numrange = 3906,

  /**
   * multirange of timestamps without time zone
   */
  tsmultirange = 4533,

  /**
   * range of timestamps without time zone
   */
  tsrange = 3908,

  /**
   * multirange of timestamps with time zone
   */
  tstzmultirange = 4534,

  /**
   * range of timestamps with time zone
   */
  tstzrange = 3910,

  // === Numeric ===

  /**
   * single-precision floating point number, 4-byte storage
   */
  float4 = 700,

  /**
   * double-precision floating point number, 8-byte storage
   */
  float8 = 701,

  /**
   * -32 thousand to 32 thousand, 2-byte storage
   */
  int2 = 21,

  /**
   * -2 billion to 2 billion integer, 4-byte storage
   */
  int4 = 23,

  /**
   * ~18 digit integer, 8-byte storage
   */
  int8 = 20,

  /**
   * monetary amounts, $d,ddd.cc
   */
  money = 790,

  /**
   * numeric(precision, decimal), arbitrary precision number
   */
  numeric = 1700,

  /**
   * object identifier(oid), maximum 4 billion
   */
  oid = 26,

  /**
   * registered class
   */
  regclass = 2205,

  /**
   * registered collation
   */
  regcollation = 4191,

  /**
   * registered text search configuration
   */
  regconfig = 3734,

  /**
   * registered text search dictionary
   */
  regdictionary = 3769,

  /**
   * registered namespace
   */
  regnamespace = 4089,

  /**
   * registered operator
   */
  regoper = 2203,

  /**
   * registered operator (with args)
   */
  regoperator = 2204,

  /**
   * registered procedure
   */
  regproc = 24,

  /**
   * registered procedure (with args)
   */
  regprocedure = 2202,

  /**
   * registered role
   */
  regrole = 4096,

  /**
   * registered type
   */
  regtype = 2206,

  // === Timespan ===

  /**
   * @ <number> <units>, time interval
   */
  interval = 1186,

  /**
   * relative, limited-range time interval (Unix delta time)
   */
  reltime = 703,

  /**
   * (abstime,abstime), time interval
   */
  tinterval = 704,

  // === Unknown ===

  /**
   * pseudo-type representing an undetermined type
   */
  unknown = 705,
}

export default PgDataTypeID;
module.exports = PgDataTypeID;
module.exports.default = PgDataTypeID;
