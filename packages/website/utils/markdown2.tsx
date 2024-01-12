import assertNever from 'assert-never';
import {Content, PhrasingContent, Image, Root} from 'mdast';
import fromMarkdown from 'mdast-util-from-markdown';
import GithubSlugger from 'github-slugger';
import {CodeTokenType} from '../components/CodeBlock';
import {readImage} from './mdast-plugins/images';
import {resolveLink} from './mdast-plugins/links';
import syntaxHighlight from './syntaxHighlight';

const tableSyntax = require('micromark-extension-gfm-table');
const tableExtension = require('mdast-util-gfm-table');

type PreparedContent =
  | Content
  | {
      type: 'codeBlocks';
      blocks: {
        lang: string;
        code: {
          type: CodeTokenType;
          value: string;
        }[];
      }[];
    }
  | (Image & {width: number; height: number})
  | {type: 'collapse'; heading: PreparedContent[]; body: PreparedContent[]};

interface Context {
  filename: string;
  slugger: GithubSlugger;
}
export async function parseMarkdown(src: string, filename: string) {
  const ast = fromMarkdown(src, {
    extensions: [tableSyntax],
    mdastExtensions: [tableExtension.fromMarkdown],
  });
  const result = await prepareParent(ast, {
    filename,
    slugger: new GithubSlugger(),
  });
  return result;
}
export function printSummaryFromMarkdown(node: Root, purpose: 'google' | 'og') {
  const result: string[] = [];
  for (const child of node.children) {
    const currentLength = result.join(`\n\n`).length;
    const nextString = printMarkdownElementAsString(child);
    const newLength = currentLength + nextString.length + 2;
    if (
      (purpose === 'google'
        ? newLength > 160 && currentLength > 50
        : newLength > 55 && currentLength > 20) ||
      child.type === 'heading'
    ) {
      break;
    }
    result.push(nextString);
  }
  return result.join(`\n\n`);
}
function printMarkdownElementAsString(
  node:
    | Content
    | {
        type: 'codeBlocks';
        blocks: {
          lang: string;
          code: {
            type: CodeTokenType;
            value: string;
          }[];
        }[];
      },
): string {
  switch (node.type) {
    case 'code':
    case 'text':
    case 'inlineCode':
      return node.value;
    case 'paragraph':
    case 'heading':
    case 'link':
    case 'linkReference':
    case 'emphasis':
    case 'strong':
      return node.children.map((c) => printMarkdownElementAsString(c)).join(``);
    case 'blockquote':
    case 'list':
      return node.children
        .map((c) => printMarkdownElementAsString(c))
        .join(`\n\n`);
    case 'table':
    case 'html':
    case 'yaml':
    case 'definition':
    case 'footnoteDefinition':
    case 'listItem':
    case 'tableRow':
    case 'tableCell':
    case 'break':
    case 'image':
    case 'delete':
    case 'footnote':
    case 'codeBlocks':
    case 'thematicBreak':
    case 'imageReference':
    case 'footnoteReference':
      return ``;
    default:
      return assertNever(node);
  }
}
async function prepareParent<
  TNode extends {children: readonly PreparedContent[]},
>(node: TNode, ctx: Context): Promise<TNode> {
  let ignoreUntil = 0;
  return {
    ...node,
    children: await Promise.all(
      node.children
        .flatMap((child, index, children): PreparedContent[] => {
          if (index < ignoreUntil) return [];
          if (child.type === 'html' && child.value === '<!--truncate-->') {
            return [];
          }
          if (child.type === 'html' && child.value === '<collapse-heading/>') {
            let foundEnd = false;
            const heading: PreparedContent[] = [];
            const body: PreparedContent[] = [];
            let currentSection = heading;
            for (
              ignoreUntil = index + 1;
              ignoreUntil < children.length;
              ignoreUntil++
            ) {
              const child = children[ignoreUntil];

              if (child.type == 'html' && child.value === '<collapse-end/>') {
                foundEnd = true;
                break;
              }
              if (child.type == 'html' && child.value === '<collapse-body/>') {
                currentSection = body;
              } else {
                currentSection.push(child);
              }
            }
            if (!foundEnd) {
              throw new Error(`Missing <!--collapse-end-->`);
            }
            ignoreUntil++;
            return [{type: 'collapse', heading, body}];
          }
          if (child.type === 'code') {
            const blocks: {
              lang: string;
              code: {
                type: CodeTokenType;
                value: string;
              }[];
            }[] = [];
            for (
              ignoreUntil = index;
              ignoreUntil < children.length &&
              children[ignoreUntil].type === 'code';
              ignoreUntil++
            ) {
              const child = children[ignoreUntil];
              if (child.type !== 'code') {
                throw new Error(`This should be unreachable`);
              }
              blocks.push(
                syntaxHighlight({
                  code: child.value,
                  language: child.lang ?? ``,
                }),
              );
            }
            return [
              {
                type: `codeBlocks`,
                blocks,
              },
            ];
          }
          return [child];
        })
        .map(async (child) => await prepare(child, ctx)),
    ),
  } as any;
}
async function prepare(
  node: PreparedContent,
  ctx: Context,
): Promise<PreparedContent> {
  switch (node.type) {
    case 'collapse':
      return {
        ...node,
        heading: (await prepareParent({children: node.heading}, ctx)).children,
        body: (await prepareParent({children: node.body}, ctx)).children,
      };
    case 'code':
      return node;
    case 'image': {
      const {width, height, alt, src} = await readImage(node, ctx.filename);
      return {...node, width, height, alt, url: src};
    }
    case 'link': {
      return await prepareParent(await resolveLink(node, ctx.filename), ctx);
    }
    case 'heading':
      return await prepareParent(
        {
          ...node,
          id: ctx.slugger.slug(
            node.children
              .map((element) => getSlugContent(element))
              .join(``)
              .replace(/\./g, '-'),
          ),
        },
        ctx,
      );
    case 'paragraph':
    case 'heading':
    case 'blockquote':
    case 'list':
    case 'table':
    case 'listItem':
    case 'tableRow':
    case 'tableCell':
    case 'strong':
    case 'emphasis':
    case 'footnote':
    case 'footnoteDefinition':
    case 'delete':
    case 'linkReference':
      return await prepareParent(node, ctx);
    case 'thematicBreak':
    case 'html':
    case 'yaml':
    case 'definition':
    case 'text':
    case 'inlineCode':
    case 'break':
    case 'imageReference':
    case 'footnoteReference':
    default:
      return node;
  }
}

function getSlugContent(element: PhrasingContent) {
  switch (element.type) {
    case 'text':
      return element.value;
    case 'inlineCode':
      return element.value.split(`(`)[0].split(`<`)[0];
  }
}
