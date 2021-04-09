import 'twin.macro';

import {IDocumentationSection} from '../../utils/docs';
import SidebarSection from './SidebarSection';
import SidebarGroup from './SidebarGroup';
import SidebarLink from './SidebarLink';

export default function Sidebar({
  activeDoc,
  sections,
}: {
  activeDoc: string;
  sections: IDocumentationSection[];
}) {
  return (
    <ul>
      {sections.map((section) => (
        <SidebarSection
          key={section.label}
          defaultExpanded={section.elements.some(
            (e) =>
              e.id === activeDoc || e.elements?.some((e) => e.id === activeDoc),
          )}
          label={section.label}
          activeDoc={activeDoc}
        >
          {section.elements.map((group) =>
            group.type === 'link' ? (
              <SidebarLink key={group.id} activeDoc={activeDoc} id={group.id}>
                {group.label}
              </SidebarLink>
            ) : (
              <SidebarGroup key={group.label} label={group.label}>
                {group.elements.map((group) => (
                  <SidebarLink
                    key={group.id}
                    activeDoc={activeDoc}
                    id={group.id}
                  >
                    {group.label}
                  </SidebarLink>
                ))}
              </SidebarGroup>
            ),
          )}
        </SidebarSection>
      ))}
    </ul>
  );
}
