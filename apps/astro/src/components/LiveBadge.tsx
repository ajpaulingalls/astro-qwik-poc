interface Props {
  isLive?: boolean;
}

export function LiveBadge({ isLive }: Props) {
  if (!isLive) return null;
  return (
    <span class="live-badge text-aj-orange text-xs font-bold tracking-wider uppercase">LIVE</span>
  );
}
