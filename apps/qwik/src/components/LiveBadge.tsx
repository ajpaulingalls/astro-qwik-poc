// Inline component (no component$): no Qrl/serialization boundary, no
// extra chunk. Stateless leaf — inlines into parent's render to keep the
// framework-graph budget small (story-009).
interface Props {
  isLive?: boolean;
}

export function LiveBadge({ isLive }: Props) {
  if (!isLive) return null;
  return (
    <span class="live-badge text-aj-orange text-xs font-bold tracking-wider uppercase">LIVE</span>
  );
}
