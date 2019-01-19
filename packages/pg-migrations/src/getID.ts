// @public

const base = 36;
const blockSize = 4;
const discreteValues = Math.pow(base, blockSize);

export default function getID(): string {
  return 'd' + timestamp() + randomBlock() + randomBlock();
}

function timestamp() {
  return pad(Date.now().toString(base), 11);
}
function randomBlock() {
  // tslint:disable-next-line:no-bitwise
  return pad(((Math.random() * discreteValues) << 0).toString(base), blockSize);
}
function pad(num: string, size: number): string {
  const s = '000000000' + num;
  return s.substr(s.length - size);
}
