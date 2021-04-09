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
      <li tw="pt-2">
        <Link href={`/docs/${id}`}>
          <a
            css={[
              activeDoc === id && tw`text-red-800 font-semibold`,
              activeDoc !== id && tw`text-gray-600`,
            ]}
            href={`/docs/${id}`}
          >
            {children}
          </a>
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
