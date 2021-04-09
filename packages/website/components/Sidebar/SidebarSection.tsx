import 'twin.macro';

import tw from 'twin.macro';
import {useEffect, useState} from 'react';
import router, {useRouter} from 'next/router';

export interface SidebarSectionProps {
  defaultExpanded: boolean;
  label: string;
  children: React.ReactNode;
  activeDoc: string;
}
const SidebarSection = ({
  defaultExpanded,
  label,
  children,
  activeDoc,
}: SidebarSectionProps) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  useEffect(() => {
    setExpanded(defaultExpanded);
  }, [defaultExpanded, activeDoc]);
  return (
    <li>
      <div tw="pt-8">
        <button
          tw="w-full flex items-center text-left text-2xl font-semibold rounded-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400"
          type="button"
          onClick={() => setExpanded((e) => !e)}
        >
          <span tw="flex-grow">{label}</span>

          <svg
            tw="transform transition-transform duration-75 ease-in-out"
            css={[!expanded && tw`rotate-90`, expanded && tw`rotate-180`]}
            width="24"
            height="24"
            viewBox="0 0 24 24"
          >
            <path
              fill="#565656"
              d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"
            ></path>
            <path d="M0 0h24v24H0z" fill="none"></path>
          </svg>
        </button>
      </div>
      <ul tw="ml-4" css={[expanded && tw`block`, !expanded && tw`hidden`]}>
        {children}
      </ul>
    </li>
  );
};

export default SidebarSection;
