import { SectionHeading } from './SectionHeading';

interface Link {
  href: string;
  label: string;
}

interface Column {
  title: string;
  links: readonly Link[];
}

const COLUMNS: readonly Column[] = [
  {
    title: 'About',
    links: [
      { href: '/about', label: 'About Us' },
      { href: '/contact', label: 'Contact' },
      { href: '/code-of-ethics', label: 'Code of Ethics' },
    ],
  },
  {
    title: 'Topics',
    links: [
      { href: '/topics/climate', label: 'Climate' },
      { href: '/topics/economy', label: 'Economy' },
      { href: '/topics/sport', label: 'Sport' },
    ],
  },
  {
    title: 'Connect',
    links: [
      { href: 'https://twitter.com/AJEnglish', label: 'X / Twitter' },
      { href: 'https://www.youtube.com/aljazeeraenglish', label: 'YouTube' },
      { href: '/newsletters', label: 'Newsletters' },
    ],
  },
];

export function Footer() {
  return (
    <footer class="mt-16 bg-neutral-900 text-neutral-100">
      <div class="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-8 md:grid-cols-3">
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <SectionHeading as="h2">{col.title}</SectionHeading>
            <ul class="space-y-2">
              {col.links.map((l) => (
                <li key={l.href}>
                  <a href={l.href} class="hover:text-aj-orange text-neutral-300">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div class="border-t border-neutral-800 px-4 py-4 text-center text-sm text-neutral-400">
        aje-poc — framework comparison build
      </div>
    </footer>
  );
}
