import spawn = require('cross-spawn');
import {Readable} from 'stream';

function buffer(stream: Readable | null, debug: 'stdout' | 'stderr' | null) {
  if (!stream) return Buffer.alloc(0);
  return new Promise<Buffer>((resolve, reject) => {
    const buffers: Buffer[] = [];
    stream.on('error', reject);
    stream.on('data', data => {
      if (debug) process[debug].write(data);
      buffers.push(data);
    });
    stream.on('end', () => resolve(Buffer.concat(buffers)));
  });
}

export default async function run(
  cmd: string,
  args: string[],
  options: {allowFailure?: boolean; debug: boolean; name: string},
) {
  const proc = spawn(cmd, args, {stdio: 'pipe'});

  const [stdout, stderr, code] = await Promise.all([
    buffer(proc.stdout, options.debug ? 'stdout' : null),
    buffer(proc.stderr, options.debug ? 'stderr' : null),
    new Promise<number | null>((resolve, reject) => {
      proc.on('error', err => reject(err));
      proc.on('exit', code => resolve(code));
    }),
  ]);

  if (code !== 0 && !options.allowFailure) {
    if (!options.debug) {
      // if we haven't already debug logged
      process.stderr.write(stderr);
      process.stdout.write(stdout);
      const err = new Error(`${options.name} extited with code ${code}`);
      (err as any).code = code;
      (err as any).stdout = stdout;
      (err as any).stderr = stderr;
      throw err;
    }
  }

  return {code, stdout, stderr};
}
