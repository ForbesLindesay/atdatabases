const assert = require('assert');
const input = require('../lib/bubble-generator-data.json');
const rules = input.rules;

let rulesOutput = [];
const printedRules = new Set();
const missing = new Set();

function printRule(ruleName) {
  let i = rulesOutput.length;
  rulesOutput.push('');
  let output = '';
  if (ruleName === 'expr') {
    const r = rules[ruleName];
    assert.strictEqual(r.body.name, 'or');
    const exps = r.body.body;
    console.log(exps);
    output += `BASE_EXPR = ` + exps.filter(
      e => e.name !== 'line' || e.body[0] !== 'expr'
    ).map(e => `(${print(e, r.body)})`).join(' / ') + '\n\n';
    output += `${printRuleName(ruleName)} = BASE_EXPR\n\n`;
  } else {
    output += `${printRuleName(ruleName)} = `;
    const rule = rules[ruleName];
    console.log(ruleName);
    output += print(rule.body);
    output += `\n\n`;
  }
  rulesOutput[i] = output;
}

printRuleName('sql-stmt-list');
const output = rulesOutput.join('') + require('fs').readFileSync(__dirname + '/sql-extra.pegjs', 'utf8');
console.log(output);

console.log([...missing].sort());
// console.log(printedRules);
require('fs').writeFileSync(
  __dirname + '/../lib/sql.pegjs',
  output,
);

function printRuleName(rawName) {
  const name = rawName.replace(/\-/g, '_').toUpperCase();
  if (printedRules.has(name)) return name;
  else {
    printedRules.add(name);
    if (rawName in rules) {
      printRule(rawName);
    }
    return name;
  }
}
function print(group, parent) {
  if (typeof group === 'string') {
    if (group === 'nil') return `""`;
    if (group in rules) {
      return printRuleName(group);
    }
    if (group[0] === '/') {
      return printRuleName(group.substr(1));
    }
    return 'WHITESPACE?' + JSON.stringify(group) + 'i WHITESPACE?';
  }
  if (typeof group !== 'object') {
    throw new Error('Expected group to be an object');
  }
  if (!group.name) {
    return `""`;
  }
  switch (group.name) {
    case 'nil':
    case 'line':
    case 'rightstack':
    case 'stack':
      return `${group.body.map(g => print(g, group)).join(' ')}`;
    case 'indentstack':
      return `${group.body.slice(1).map(g => print(g, group)).join(' ')}`;
    case 'toploop':
    case 'loop':
      if (group.body.length === 1) {
        return `(${print(group.body[0], group)})+`;
      }
      if (group.body.length !== 2) {
        console.log('parent', parent);
        console.dir(group.name);
        console.dir(group.body);
        throw new Error('Expected loop to have two elements');
      }
      const [element, join] = group.body;
      return `${print(element, group)} (${print(join, group)} ${print(element, group)})*`;
    case 'opt':
    case 'optx':
      return `(${group.body.map(g => print(g, group)).join(' ')})?`;
    case 'or':
    case 'tailbranch':
      return `(${group.body.map(g => `(${print(g, group)})`).join(' / ')})`;
    case ',':
      return `"," ${group.body.map(g => print(g, group)).join(' ')}`;
    default:
      console.log('parent', parent);
      console.dir(group.name);
      console.dir(group.body);
      process.exit(1);
      // throw new Error(`Unsupported group type ${group.name}`);
  }
}
