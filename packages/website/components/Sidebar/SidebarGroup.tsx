import 'twin.macro';

import {memo} from 'react';

export interface SidebarGroupProps {
  label: string;
  children: React.ReactNode;
}

const SidebarGroup = memo(({children, label}: SidebarGroupProps) => {
  return (
    <li>
      <div tw="font-semibold pt-4">{label}</div>
      <ul tw="ml-4">{children}</ul>
    </li>
  );
});

export default SidebarGroup;
