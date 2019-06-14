console.log('starting sql parser');
const parser = require('../lib/sql');

function tryParse(str) {
  console.log('Parsing: ' + str);
  try {
    const result = parser.parse(str)
    console.dir(result, {depth: 10});
  } catch (ex) {
    console.log(ex.location);
    console.log(ex.message);
    console.log(ex.expected);
    console.log(ex.found);
    // throw ex;
  }
}
tryParse('SELECT * FROM foo');
