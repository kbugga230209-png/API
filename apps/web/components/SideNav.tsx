'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const SECTIONS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: 'Today',
    links: [
      { href: '/app', label: 'Dashboard' },
      { href: '/app/diary', label: 'Diary' },
      { href: '/app/planner', label: 'Diet planner' },
    ],
  },
  {
    title: 'You',
    links: [
      { href: '/app/settings', label: 'Goals and settings' },
      { href: '/app/account', label: 'Account and data' },
      { href: '/app/plus', label: 'BharatBite Plus' },
    ],
  },
  {
    title: 'Explore',
    links: [{ href: '/foods', label: 'Food database' }],
  },
];

export function SideNav() {
  const pathname = usePathname();

  return (
    <nav className="side-nav" aria-label="App sections">
      {SECTIONS.map((section) => (
        <div key={section.title} style={{ display: 'contents' }}>
          <span className="side-title">{section.title}</span>
          {section.links.map((link) => {
            const active = link.href === '/app' ? pathname === '/app' : pathname.startsWith(link.href);
            return (
              <Link key={link.href} href={link.href} aria-current={active ? 'page' : undefined}>
                {link.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
