import type { ReactNode } from "react";

/**
 * Общи филтърни контроли — ЕДИНСТВЕНОТО място за стил на филтри.
 * /zakoni и /aktove (и всички бъдещи филтърни страници) ги ползват,
 * за да изглеждат еднакво. Виж docs/ui-components.md.
 */

export function FilterSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="mt-4 w-full rounded-xl border border-zinc-300 px-4 py-2.5 text-base outline-none focus:border-accent sm:max-w-xl sm:text-sm"
    />
  );
}

export function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-xs font-medium touch-manipulation transition-colors ${
        active
          ? "border-accent bg-accent text-white cursor-default"
          : "border-zinc-300 text-zinc-600 hover:border-zinc-500 hover:text-accent active:bg-zinc-100 cursor-pointer"
      }`}
    >
      {children}
    </button>
  );
}

export function FilterChipRow({ children }: { children: ReactNode }) {
  return <div className="mt-3 flex flex-wrap gap-2 text-xs">{children}</div>;
}
