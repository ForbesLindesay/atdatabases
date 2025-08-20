import 'twin.macro';

import tw from 'twin.macro';
import {memo} from 'react';
import Link from 'next/link';

export interface SidebarLinkProps {
  children: string;
  id: string;
  activeDoc: string;
}

const SidebarLink = memo<SidebarLinkProps>(
  ({children, id, activeDoc}) => {
    return (
      <li>
        <Link
          href={`/docs/${id}`}
          tw="py-1 mt-1 -mb-1 block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-gray-300"
          css={[
            activeDoc === id && tw`text-red-800 font-semibold`,
            activeDoc !== id && tw`text-gray-500 hover:text-gray-700`,
          ]}
        >
          {children}
        </Link>
      </li>
    );
  },
  (prevProps, nextProps) =>
    prevProps.children === nextProps.children &&
    prevProps.id === nextProps.id &&
    (prevProps.id === prevProps.activeDoc) ===
      (nextProps.id === nextProps.activeDoc),
);

export default SidebarLink;
