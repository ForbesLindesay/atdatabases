import 'twin.macro';
import type * as m from 'mdast';
import tw from 'twin.macro';
import {memo} from 'react';

const DocumentTableOfContents = memo(({document}: {document: m.Root}) => {
  return (
    <ul tw="border-l-2 border-gray-100 pl-2 mt-8 ml-8 text-gray-600">
      {document.children.map((node, i) => {
        if (node.type === 'heading' && node.depth <= 5) {
          return (
            <li
              key={i}
              css={[
                node.depth === 3 && tw`ml-2 text-sm text-gray-500`,
                node.depth === 4 && tw`ml-4 text-xs text-gray-500`,
              ]}
            >
              <a href={`#${(node as any).id}`}>
                {node.children.map((child, i) => (
                  <HeadingContent key={i} node={child} />
                ))}
              </a>
            </li>
          );
        }
        return null;
      })}
    </ul>
  );
});
export default DocumentTableOfContents;

function HeadingContent({node}: {node: m.PhrasingContent}) {
  switch (node.type) {
    case 'text':
      return <>{node.value}</>;
    case 'inlineCode':
      return (
        <span tw="font-mono">{node.value.split(`(`)[0].split(`<`)[0]}</span>
      );
    default:
      throw new Error(
        `Unsupported element in heading for table of contents: "${node.type}"`,
      );
  }
}
