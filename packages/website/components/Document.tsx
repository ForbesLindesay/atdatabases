import 'twin.macro';
import type * as m from 'mdast';
import tw from 'twin.macro';
import {createContext, memo, useContext} from 'react';
import {CodeBlock, CodeTokenType} from './CodeBlock';

const HeadingContext = createContext(false);
function useIsInHeading() {
  return useContext(HeadingContext);
}
const BlockquoteContext = createContext(false);
function useIsInBlockquote() {
  return useContext(BlockquoteContext);
}

const nodeRenderers: {
  [TType in m.Content['type']]?: (props: {
    node: Extract<m.Content, {readonly type: TType}>;
    index: number;
  }) => React.ReactElement<any, any> | null;
} = {
  blockquote: DocumentBlockquote,
  heading: DocumentHeading,
  image: DocumentImage,
  inlineCode: DocumentInlineCode,
  link: DocumentLink,
  list: DocumentList,
  listItem: DocumentListItem,
  paragraph: DocumentParagraph,
  strong: DocumentStrong,
  table: DocumentTable,
  text: DocumentText,
};
const Document = memo(({document}: {document: m.Root}) => {
  return <DocumentChildren>{document}</DocumentChildren>;
});
export default Document;

function DocumentChildren({children}: {children: m.Parent}) {
  return (
    <>
      {children.children.map((node, index) => (
        <DocumentElement key={index} index={index} node={node} />
      ))}
    </>
  );
}

function DocumentElement({
  index,
  node,
}: {
  index: number;
  node:
    | m.Content
    | {
        type: 'codeBlocks';
        blocks: {
          lang: string;
          code: {
            type: CodeTokenType;
            value: string;
          }[];
        }[];
      };
}) {
  const isInBlockquote = useIsInBlockquote();
  switch (node.type) {
    case 'codeBlocks':
      return <CodeBlock blocks={node.blocks} isInBlockquote={isInBlockquote} />;
    default:
      const NodeRenderer: any = nodeRenderers[node.type];
      if (NodeRenderer !== undefined) {
        return <NodeRenderer index={index} node={node} />;
      }
      // throw new Error(`Unknown node type: ${node.type}`);
      return <pre>{JSON.stringify(node, null, `  `)}</pre>;
  }
}

function DocumentBlockquote({
  index,
  node,
}: {
  index: number;
  node: m.Blockquote;
}) {
  return (
    <BlockquoteContext.Provider value={true}>
      <blockquote
        tw="border-l-8 border-yellow-300 bg-yellow-50 px-6 py-4"
        css={[index !== 0 && tw`mt-4`]}
      >
        <DocumentChildren>{node}</DocumentChildren>
      </blockquote>
    </BlockquoteContext.Provider>
  );
}

function DocumentHeading({index, node}: {index: number; node: m.Heading}) {
  const isInBlockquote = useIsInBlockquote();
  const isInHeading = useIsInHeading();
  if (!isInHeading) {
    return (
      <HeadingContext.Provider value={true}>
        <DocumentHeading index={index} node={node} />
      </HeadingContext.Provider>
    );
  }
  const id: string = `${(node as any).id}`;
  const anchor = isInBlockquote ? null : (
    <>
      <a
        aria-hidden
        id={id}
        tw="absolute top-0 transform -translate-y-32 xl:-translate-y-16"
        tabIndex={-1}
      />
      <a
        href="#cli"
        aria-hidden
        tw="flex flex-shrink-0 justify-center items-center -ml-6 w-6 opacity-0 group-hover:opacity-100"
        tabIndex={-1}
      >
        <svg
          aria-hidden
          height="16"
          version="1.1"
          viewBox="0 0 16 16"
          width="16"
        >
          <path
            fillRule="evenodd"
            d="M4 9h1v1H4c-1.5 0-3-1.69-3-3.5S2.55 3 4 3h4c1.45 0 3 1.69 3 3.5 0 1.41-.91 2.72-2 3.25V8.59c.58-.45 1-1.27 1-2.09C10 5.22 8.98 4 8 4H4c-.98 0-2 1.22-2 2.5S3 9 4 9zm9-3h-1v1h1c1 0 2 1.22 2 2.5S13.98 12 13 12H9c-.98 0-2-1.22-2-2.5 0-.83.42-1.64 1-2.09V6.25c-1.09.53-2 1.84-2 3.25C6 11.31 7.55 13 9 13h4c1.45 0 3-1.69 3-3.5S14.5 6 13 6z"
          ></path>
        </svg>
      </a>
    </>
  );
  switch (node.depth) {
    case 1:
      return (
        <h1 tw="flex relative text-2xl sm:text-4xl">
          {anchor}
          <DocumentChildren>{node}</DocumentChildren>
        </h1>
      );
    case 2:
      return (
        <h2
          tw="flex relative text-xl sm:text-3xl text-black font-semibold"
          css={[index !== 0 && tw`mt-12`]}
        >
          {anchor}
          <DocumentChildren>{node}</DocumentChildren>
        </h2>
      );
    case 3:
      return (
        <h3
          tw="flex relative text-lg sm:text-2xl text-black font-semibold"
          css={[index !== 0 && tw`mt-6`]}
          className="group"
        >
          {anchor}
          <DocumentChildren>{node}</DocumentChildren>
        </h3>
      );
    case 4:
      return (
        <h4
          tw="flex relative text-lg sm:text-2xl text-gray-900"
          css={[index !== 0 && tw`mt-6`]}
        >
          {anchor}
          <DocumentChildren>{node}</DocumentChildren>
        </h4>
      );
    case 5:
      return (
        <h5
          tw="flex relative text-xl text-gray-900 font-semibold"
          css={[index !== 0 && tw`mt-6`]}
        >
          {anchor}
          <DocumentChildren>{node}</DocumentChildren>
        </h5>
      );
    default:
      return (
        <h6
          tw="flex relative text-xl text-gray-800"
          css={[index !== 0 && tw`mt-6`]}
        >
          {anchor}
          <DocumentChildren>{node}</DocumentChildren>
        </h6>
      );
  }
}

function DocumentImage({
  node,
}: {
  node: m.Image & {width?: number; height?: number};
}) {
  return (
    <img
      tw="rounded shadow-sm"
      src={node.url}
      alt={node.alt ?? undefined}
      width={node.width}
      height={node.height}
    />
  );
}

function DocumentInlineCode({node}: {node: m.InlineCode}) {
  const isInHeading = useIsInHeading();
  const isInBlockquote = useIsInBlockquote();
  if (isInHeading) {
    return <code tw="font-mono">{node.value}</code>;
  }
  if (node.value.startsWith(`@[[[`) && node.value.endsWith(`]]]@`)) {
    return (
      <span tw="p-1 -my-1 rounded-sm bg-yellow-200">
        {node.value.substring(`@[[[`.length, node.value.length - `]]]@`.length)}
      </span>
    );
  }
  return (
    <code
      tw="font-mono p-1 -my-1 rounded-sm"
      css={[
        !isInBlockquote && tw`bg-gray-100`,
        isInBlockquote && tw`bg-yellow-100 text-gray-900`,
      ]}
    >
      {node.value}
    </code>
  );
}

function DocumentLink({node}: {node: m.Link}) {
  return (
    <a
      tw="text-red-700 hover:underline hover:text-red-900 focus-visible:outline-none rounded-sm focus-visible:ring-2 focus-visible:ring-offset-4 focus-visible:ring-gray-400"
      title={node.title ?? undefined}
      href={node.url}
    >
      <DocumentChildren>{node}</DocumentChildren>
    </a>
  );
}

function DocumentList({index, node}: {index: number; node: m.List}) {
  return node.ordered ? (
    <ol tw="list-decimal ml-6" css={[index !== 0 && tw`mt-4`]}>
      <DocumentChildren>{node}</DocumentChildren>
    </ol>
  ) : (
    <ul tw="list-disc ml-6" css={[index !== 0 && tw`mt-4`]}>
      <DocumentChildren>{node}</DocumentChildren>
    </ul>
  );
}

function DocumentListItem({index, node}: {index: number; node: m.ListItem}) {
  return (
    <li css={[index !== 0 && tw`mt-2`]}>
      <DocumentChildren>{node}</DocumentChildren>
    </li>
  );
}

function DocumentParagraph({index, node}: {index: number; node: m.Paragraph}) {
  return (
    <p css={[index !== 0 && tw`mt-4`]}>
      <DocumentChildren>{node}</DocumentChildren>
    </p>
  );
}

function DocumentStrong({node}: {node: m.Strong}) {
  return (
    <strong tw="text-black font-semibold">
      <DocumentChildren>{node}</DocumentChildren>
    </strong>
  );
}

function DocumentTable({node}: {node: m.Table}) {
  return (
    <table tw="text-base min-w-full divide-y divide-gray-200 mt-6 border border-gray-200">
      <thead tw="bg-gray-50">
        <tr>
          {node.children[0].children.map((cell, i) => (
            <th
              key={i}
              scope="col"
              tw="px-6 py-3 text-left text-xs font-medium text-gray-600 tracking-wider whitespace-nowrap"
            >
              <DocumentChildren>{cell}</DocumentChildren>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {node.children.slice(1).map((row, i) => (
          <tr
            key={i}
            css={[i % 2 === 0 && tw`bg-white`, i % 2 !== 0 && tw`bg-gray-50`]}
          >
            {row.children.map((cell, i) => (
              <td key={i} tw="px-6 py-4 text-xs md:text-sm text-gray-600">
                <DocumentChildren>{cell}</DocumentChildren>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DocumentText({node}: {node: m.Text}) {
  return <>{node.value}</>;
}
