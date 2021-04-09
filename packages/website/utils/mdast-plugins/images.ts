import {createHash} from 'crypto';
import {promises as fs} from 'fs';
import {resolve, dirname, extname, join} from 'path';
import {Image} from 'mdast';
import sizeOf from 'image-size';

export async function readImage(img: Image, filename: string) {
  let imgFilename = img.url;
  if (!img.alt) {
    throw new Error(`Image is missing alt text`);
  }
  if (img.url.startsWith(`http:`) || img.url.startsWith(`https:`)) {
    throw new Error(`All images must be downloaded before use`);
  } else {
    imgFilename = resolve(dirname(filename), imgFilename);
  }
  const {width, height} = await new Promise<{
    width: number | undefined;
    height: number | undefined;
    orientation?: number;
    type?: string;
  }>((resolve, reject) =>
    sizeOf(imgFilename, (e, r) => {
      if (e) reject(e);
      else resolve(r!);
    }),
  );
  await fs.mkdir(`public/static/img`, {recursive: true});
  const imageContents = await fs.readFile(imgFilename);
  const imageHash = createHash('sha1')
    .update(imageContents)
    .digest('hex')
    .substr(0, 6);
  const imageName = `static/img/${imageHash}${extname(imgFilename)}`;
  await fs.writeFile(join(`public`, imageName), imageContents);
  return {width, height, alt: img.alt, src: `/${imageName}`};
}
