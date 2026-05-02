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
