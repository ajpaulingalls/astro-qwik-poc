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
      <div class="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-3">
        <a href="/" aria-label="Al Jazeera English" class="flex items-center gap-2">
          <span
            aria-hidden="true"
            class="bg-aj-orange flex h-9 w-9 items-center justify-center rounded-sm text-sm font-extrabold tracking-tight text-white"
          >
            AJE
          </span>
          <span class="hidden text-base font-bold tracking-tight text-neutral-900 sm:inline">
            AL&nbsp;JAZEERA <span class="text-neutral-500">English</span>
          </span>
        </a>
        <div class="flex items-center gap-3">
          {/* Static visual indicator — not wired to live broadcast state, so hidden from a11y */}
          <span
            aria-hidden="true"
            class="hidden items-center gap-1.5 rounded-full bg-neutral-900 px-2.5 py-1 text-xs font-bold tracking-wider text-white uppercase sm:inline-flex"
          >
            <span aria-hidden="true" class="h-1.5 w-1.5 rounded-full bg-red-500" />
            LIVE
          </span>
          {/* Visual stub — search route not yet implemented */}
          <button
            type="button"
            aria-label="Search"
            class="hover:text-aj-orange rounded p-1.5 text-neutral-700"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
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
      </div>
      <ul
        class={`mx-auto max-w-6xl flex-col gap-4 px-4 pb-3 md:flex-row md:gap-6 ${
          open ? 'flex' : 'hidden md:flex'
        }`}
      >
        {SECTIONS.map((s) => (
          <li key={s.href}>
            <a
              href={s.href}
              class="hover:text-aj-orange text-sm font-medium tracking-wide text-neutral-700"
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
