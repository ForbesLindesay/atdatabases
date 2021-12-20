import {promises as fs} from 'fs';

import fm from 'front-matter';
import {resolve} from 'path';

export interface IDocumentationLink {
  type: 'link';
  label: string;
  id: string;
  elements?: undefined;
}

export interface IDocumentationGroup {
  type: 'group';
  label: string;
  id?: undefined;
  elements: IDocumentationLink[];
}

export interface IDocumentationSection {
  type: 'section';
  label: string;
  id?: undefined;
  elements: (IDocumentationLink | IDocumentationGroup)[];
}

export interface IDocumentAttributes {
  id: string;
  title: string;
  sidebar_label?: string;
  summary?: string;
  ogSummary?: string;
  googleSummary?: string;
}
export interface IDocument<TBody = string> extends IDocumentAttributes {
  filename: string;
  body: TBody;
  path?: string[];
  previous?: {label: string; id: string};
  next?: {label: string; id: string};
}

async function getDocsUncached() {
  const [sidebars, docs] = await Promise.all([
    readSidebarsConfig(),
    readFiles(),
  ]);
  let previousDoc: undefined | IDocument;
  const resolveLink = (id: string, path: string[]): IDocumentationLink => {
    const doc = docs.get(id);
    if (!doc) {
      throw new Error(`Missing document: "${id}"`);
    }
    doc.path = path;
    const nextLink: IDocumentationLink = {
      type: 'link',
      label: doc.sidebar_label ?? doc.title,
      id: doc.id,
    };
    if (previousDoc) {
      previousDoc.next = {
        label: doc.sidebar_label ?? doc.title,
        id: doc.id,
      };
      doc.previous = {
        label: previousDoc.sidebar_label ?? previousDoc.title,
        id: previousDoc.id,
      };
    }
    previousDoc = doc;
    return nextLink;
  };
  const nav = Object.keys(sidebars.docs).map(
    (sectionLabel): IDocumentationSection => ({
      type: 'section',
      label: sectionLabel,
      elements: sidebars.docs[sectionLabel].map(
        (group): IDocumentationLink | IDocumentationGroup => {
          if (typeof group === 'string') {
            return resolveLink(group, [sectionLabel]);
          }
          return {
            type: 'group',
            label: group.label,
            elements: group.ids.map((id) =>
              resolveLink(id, [sectionLabel, group.label]),
            ),
          };
        },
      ),
    }),
  );
  return {nav, docs};
}
let cache:
  | {
      created: number;
      value: Promise<{
        nav: IDocumentationSection[];
        docs: Map<string, IDocument<string>>;
      }>;
    }
  | undefined;
export async function getDocs() {
  if (cache && cache.created > Date.now() - 1000) {
    return await cache.value;
  }
  cache = {created: Date.now(), value: getDocsUncached()};
  try {
    return await cache.value;
  } catch (ex) {
    cache = undefined;
    throw ex;
  }
}
async function readSidebarsConfig() {
  const sidebars: {
    docs: {
      [key: string]: (
        | string
        | {
            type: 'subcategory';
            label: 'Guides';
            ids: string[];
          }
      )[];
    };
  } = JSON.parse(await fs.readFile(`../../docs/sidebars.json`, `utf8`));
  return sidebars;
}

async function readFiles() {
  const filenames = (await fs.readdir(`../../docs`)).filter((filename) =>
    filename.endsWith(`.md`),
  );
  const files = await Promise.all(
    filenames.map((fileName) => readFile(fileName)),
  );
  return new Map(files.map((f) => [f.id, f]));
}

async function readFile(filename: string): Promise<IDocument> {
  const absoluteFilename = resolve(`../../docs/${filename}`);
  const src = await fs.readFile(absoluteFilename, `utf8`);
  const {attributes, body} = fm<IDocumentAttributes>(src);
  return {
    ...attributes,
    filename: absoluteFilename,
    body,
  };
}
