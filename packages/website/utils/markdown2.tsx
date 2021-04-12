import {Content, PhrasingContent} from 'mdast';
import fromMarkdown from 'mdast-util-from-markdown';
import GithubSlugger from 'github-slugger';
import {CodeTokenType} from '../components/CodeBlock';
import {readImage} from './mdast-plugins/images';
import {resolveLink} from './mdast-plugins/links';
import syntaxHighlight from './syntaxHighlight';

const tableSyntax = require('micromark-extension-gfm-table');
const tableExtension = require('mdast-util-gfm-table');

interface Context {
  filename: string;
  slugger: GithubSlugger;
}
export async function parseMarkdown(src: string, filename: string) {
  const ast = fromMarkdown(src, {
    extensions: [tableSyntax],
    mdastExtensions: [tableExtension.fromMarkdown],
  });
  return await prepareParent(ast, {filename, slugger: new GithubSlugger()});
}
async function prepareParent<TNode extends {children: readonly Content[]}>(
  node: TNode,
  ctx: Context,
): Promise<TNode> {
  return {
    ...node,
    children: (
      await Promise.all(
        node.children.map(async (child, index, children) => {
          if (child.type === 'html' && child.value === '<!--truncate-->') {
            return [];
          }
          if (
            child.type === 'code' &&
            index > 0 &&
            children[index - 1].type === 'code'
          ) {
            return [];
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
              let i = index;
              i < children.length && children[i].type === 'code';
              i++
            ) {
              const child = children[i];
              if (child.type !== 'code') {
                break;
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
          return [await prepare(child, ctx)];
        }),
      )
    ).flat(1),
  } as any;
}
async function prepare(node: Content, ctx: Context): Promise<Content> {
  switch (node.type) {
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
