// @public

const base = 36;
const blockSize = 4;
const discreteValues = Math.pow(base, blockSize);

export default function getID() {
  return 'd' + timestamp() + randomBlock() + randomBlock();
}

function timestamp() {
  return pad(Date.now().toString(base), 11);
}
function randomBlock() {
  return pad(((Math.random() * discreteValues) << 0).toString(base), blockSize);
}
function pad(num: string, size: number): string {
  var s = '000000000' + num;
  return s.substr(s.length - size);
}
