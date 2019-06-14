const parser = require('../lib/tcl.js');
try {
  const result = parser.parse(require('fs').readFileSync(__dirname + '/bubble-generator-data.tcl', 'utf8'));
  require('fs').writeFileSync(__dirname + '/../lib/bubble-generator-data.json', JSON.stringify(result, null, '  '));
} catch (ex) {
	console.log(ex);
	throw ex;
}
