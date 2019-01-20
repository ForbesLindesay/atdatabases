const fs = require('fs');
const prettier = require('prettier');
const errorCodes = require('pg-error-constants');

async function formatResult(src, filename) {
  const options = (await prettier.resolveConfig(filename, {})) || {};
  options.parser = 'typescript';
  return prettier.format(src, options);
}
(async () => {
  const result = [];
  result.push(`export enum SQLErrorCode {`);
  Object.keys(errorCodes).forEach(name => {
    result.push(`  ${name} = ${JSON.stringify(errorCodes[name])},`);
  });
  result.push(`}`);
  result.push(`export default SQLErrorCode;`);
  result.push(`export const SQLErrorCodes = new Set([`);
  Object.keys(errorCodes).forEach(name => {
    result.push(`  SQLErrorCode.${name},`);
  });
  result.push(`]);`);
  const src = await formatResult(
    result.join('\n') + '\n',
    __dirname + '/src/SQLErrorCode.ts',
  );
  fs.writeFileSync(__dirname + '/src/SQLErrorCode.ts', src);
})().catch(ex => {
  console.error(ex.message);
  process.exit(1);
});
