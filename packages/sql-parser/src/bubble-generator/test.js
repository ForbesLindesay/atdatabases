
const parser = require('../lib/sql');
try {
  const result = parser.parse(`SELECT * FROM my_table;`);
  console.dir(result, {depth: 10});
} catch (ex) {
	console.log(ex);
	throw ex;
}
