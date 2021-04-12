import {promises as fs} from 'fs';
import {dirname, resolve} from 'path';
import {Link} from 'mdast';
import {getDocs} from '../docs';

export async function resolveLink(link: Link, filename: string) {
  if (link.url.includes(`:`)) {
    return link;
  }
  const resolvedFilename = resolve(dirname(filename), link.url);
  const fileExists = await fs.stat(resolvedFilename).then(
    (s) => s.isFile(),
    () => false,
  );
  if (!fileExists) {
    throw new Error(`Cannot find linked path: ${link.url}`);
  }
  const doc = Array.from((await getDocs()).docs.values()).find(
    (doc) => doc.filename === resolvedFilename,
  );
  if (!doc) {
    throw new Error(`Cannot find the doc: ${resolvedFilename}`);
  }
  return {...link, url: `/docs/${doc.id}`, title: doc.title};
}
