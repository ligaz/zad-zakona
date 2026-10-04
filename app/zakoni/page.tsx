"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Law } from "@/lib/types";
import { HIDDEN_LAW_IDS } from "@/lib/types";
import lawsJson from "@/data/laws.json";
import { FilterChip, FilterChipRow, FilterSearch } from "@/components/Filters";
import { PageHeader } from "@/components/Viz";

const laws: Law[] = (lawsJson as Law[]).filter((l) => !HIDDEN_LAW_IDS.has(l.id));

export default function Zakoni() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("Всички");
  const cats = ["Всички", ...Array.from(new Set(laws.map((l) => l.category)))];

  const sorted = useMemo(() => {
    const ql = q.toLowerCase();
    return laws
      .filter(
        (l) =>
          (!q || (l.name + " " + l.description + " " + l.code).toLowerCase().includes(ql)) &&
          (cat === "Всички" || l.category === cat)
      )
      .sort((a, b) => a.name.localeCompare(b.name, "bg"));
  }, [q, cat]);

  return (
    <div className="pb-10">
      <section className="pb-8 pt-4">
        <PageHeader
          title={`Закони (${sorted.length})`}
          description="Всеки закон с историята на измененията си — какво се промени, кой гласува и кой управляваше."
        />

        <FilterSearch value={q} onChange={setQ} placeholder="Търси: тротинетки, болнични, Шенген…" />

        <FilterChipRow>
          {cats.map((c) => (
            <FilterChip key={c} active={cat === c} onClick={() => setCat(c)}>
              {c}
            </FilterChip>
          ))}
        </FilterChipRow>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((l) => (
          <Link key={l.id} href={`/zakoni/${l.id}`} className="group rounded-2xl border border-zinc-200 bg-white p-4 transition hover:border-accent hover:shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">{l.category} · {l.code}</p>
            <h2 className="mt-1 break-words font-bold leading-snug group-hover:underline dark:text-white">{l.name}</h2>
            <p className="mt-1 line-clamp-2 text-sm text-zinc-500 dark:text-zinc-400">{l.description}</p>
            <p className="mt-3 text-xs font-medium text-zinc-700 dark:text-zinc-300">{l.amendments.length} изменения · от {l.firstAdopted} насам →</p>
          </Link>
        ))}
      </section>
      {sorted.length === 0 && (
        <p className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-600 dark:text-zinc-400">Няма резултати. Опитай с друга дума или изчисти филтрите.</p>
      )}
    </div>
  );
}
