import {promises as fs} from 'fs';

import fm from 'front-matter';
import {resolve} from 'path';

export interface IBlogAttributes {
  summary?: string;
  ogSummary?: string;
  googleSummary?: string;
  title: string;
  author?: string;
  authorURL?: string;
  authorTwitter?: string;
}
export interface IBlogPost<TBody = string> extends IBlogAttributes {
  pathname: string;
  year: number;
  month: number;
  day: number;
  id: string;
  filename: string;
  body: TBody;
}

let cache:
  | {
      created: number;
      value: Promise<IBlogPost<string>[]>;
    }
  | undefined;
export async function getBlogPosts() {
  if (cache && cache.created > Date.now() - 1000) {
    return await cache.value;
  }
  cache = {created: Date.now(), value: readFiles()};
  try {
    return await cache.value;
  } catch (ex) {
    cache = undefined;
    throw ex;
  }
}
async function readFiles() {
  const filenames = (await fs.readdir(`../../docs/blog`))
    .sort()
    .reverse()
    .filter((filename) => filename.endsWith(`.md`));
  return await Promise.all(filenames.map((fileName) => readFile(fileName)));
}

async function readFile(filename: string): Promise<IBlogPost> {
  const absoluteFilename = resolve(`../../docs/blog/${filename}`);
  const src = await fs.readFile(absoluteFilename, `utf8`);
  const {attributes, body} = fm<IBlogAttributes>(src);
  const match = /^(\d{4})-(\d{2})-(\d{2})-(.*)\.md$/.exec(filename);
  if (!match) {
    throw new Error(`Blog post has invalid filename: "${filename}"`);
  }
  const params = {
    year: parseInt(match[1], 10),
    month: parseInt(match[2], 10),
    day: parseInt(match[3], 10),
    id: match[4],
  };
  return {
    ...attributes,
    ...params,
    pathname: `/blog/${params.year}/${params.month
      .toString(10)
      .padStart(2, `0`)}/${params.day.toString(10).padStart(2, `0`)}/${
      params.id
    }`,
    filename: absoluteFilename,
    body,
  };
}
