import { useState } from 'preact/hooks';

interface Section {
  href: string;
  label: string;
}

const SECTIONS: readonly Section[] = [
  { href: '/middle-east', label: 'Middle East' },
  { href: '/asia-pacific', label: 'Asia Pacific' },
  { href: '/us-canada', label: 'US & Canada' },
  { href: '/europe', label: 'Europe' },
  { href: '/africa', label: 'Africa' },
  { href: '/latin-america', label: 'Latin America' },
  { href: '/opinion', label: 'Opinion' },
];

export function NavigationMenu(): preact.JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <nav class="border-b border-neutral-200 bg-white">
      <div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <a href="/" class="text-aj-orange text-xl font-bold">
          AJE
        </a>
        <button
          type="button"
          aria-label="Menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          class="border-neutral-300 rounded border px-3 py-1 md:hidden"
        >
          ☰
        </button>
      </div>
      <ul
        class={`mx-auto max-w-6xl flex-col gap-4 px-4 pb-3 md:flex-row ${
          open ? 'flex' : 'hidden md:flex'
        }`}
      >
        {SECTIONS.map((s) => (
          <li key={s.href}>
            <a href={s.href} class="hover:text-aj-orange text-neutral-700">
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
