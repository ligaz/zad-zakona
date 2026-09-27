import { coalitionParties, partyColor } from "@/lib/parties";

/** Точки с цветовете на управляващата коалиция (или сиво за служебни). */
export function CoalitionDots({
  coalition,
  size = "h-2 w-2",
}: {
  coalition: string[];
  size?: string;
}) {
  const parties = coalitionParties(coalition);
  if (parties.length === 0) {
    return (
      <span title="Служебно правителство — без партийна коалиция">
        <i className={`inline-block aspect-square shrink-0 rounded-full bg-zinc-400 ${size}`} />
      </span>
    );
  }
  return (
    <span className="flex shrink-0 items-center leading-none">
      {parties.map((p, idx) => (
        <i
          key={p}
          title={p}
          className={`inline-block aspect-square shrink-0 rounded-full border border-white ${size}`}
          style={{ marginLeft: idx === 0 ? 0 : -4, background: partyColor(p) }}
        />
      ))}
    </span>
  );
}
