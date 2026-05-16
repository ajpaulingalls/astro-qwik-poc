// Inline component (no component$): no Qrl/serialization boundary, no
// extra chunk. Stateless leaf — inlines into parent's render to keep the
// framework-graph budget small (story-009).
interface Props {
  isLive?: boolean;
  size?: 'sm' | 'lg';
}

const SIZE_CLASS = {
  sm: 'text-xs font-bold tracking-wider',
  lg: 'text-sm font-extrabold tracking-widest',
} as const;

export function LiveBadge({ isLive, size = 'sm' }: Props) {
  if (!isLive) return null;
  return <span class={`text-aj-orange uppercase ${SIZE_CLASS[size]}`}>LIVE</span>;
}
