"use client";

import { useMemo, useState } from "react";
import type { ActEntry } from "@/lib/data";
import type { Assembly } from "@/lib/types";
import actsIndexJson from "@/data/acts-index.json";
import assembliesJson from "@/data/assemblies.json";
import { CoalitionDots } from "@/components/CoalitionDots";
import { ActCard, PageHeader } from "@/components/Viz";
import { FilterChip, FilterChipRow, FilterSearch } from "@/components/Filters";

const allAssemblies: Assembly[] = assembliesJson as Assembly[];

function numIss(value: string | null): number {
  const match = (value || "").match(/\d+/);
  return match ? Number(match[0]) : 0;
}

/** Пълен автоматичен индекс (parliament.bg API) — винаги НОВИТЕ НАПРЕД. */
const actsIndex: ActEntry[] = (actsIndexJson as ActEntry[])
  .filter((a) => a.dv_iss && a.dv_year && (a.dv_year as number) >= 2021)
  .sort(
    (a, b) =>
      ((b.dv_year ?? 0) as number) - ((a.dv_year ?? 0) as number) ||
      numIss(b.dv_iss) - numIss(a.dv_iss) ||
      (b.date ?? "").localeCompare(a.date ?? "") ||
      b.id - a.id
  );

/** Кое НС е било активно на дадена дата (по дата на приемане). */
function assemblyForDate(iso: string | null): Assembly | null {
  if (!iso) return null;
  const day = iso.slice(0, 10);
  return (
    allAssemblies.find(
      (a) => a.from && day >= a.from && (!a.to || day <= a.to)
    ) ?? null
  );
}

function kindOf(title: string): string {
  const t = (title || "").replace(/\s+/g, " ").trim();
  if (/ратифиц/i.test(t)) return "Ратификации";
  if (/^решени/i.test(t)) return "Решения";
  if (/^декларац|^обръщение|^позиция/i.test(t)) return "Декларации";
  if (/^правилник/i.test(t)) return "Правилник на НС";
  if (/изменение|допълнение/i.test(t)) return "Изменения на закони";
  if (/^закон/i.test(t)) return "Нови закони";
  if (/^кодекс/i.test(t)) return "Кодекси";
  return "Други";
}

/** Подвид на решение — втори ред филтри, само при kind === "Решения". */
function subKindOf(title: string): string {
  const t = (title || "").replace(/\s+/g, " ").trim();
  if (/ваканц/i.test(t)) return "Ваканции";
  if (/делегац/i.test(t)) return "Делегации";
  if (/процедурни правила/i.test(t)) return "Процедурни правила";
  if (/прекратяване пълномощ/i.test(t)) return "Край на мандати";
  if (/недоверие|вот на недоверие|оставка|оставк/i.test(t)) return "Вотове и оставки";
  if (/отчет|доклад/i.test(t)) return "Отчети";
  if (/програм|дневен ред/i.test(t)) return "Програми";
  if (/създаване на|избиране на комисия|избиране на временна/i.test(t)) return "Комисии — създаване";
  if (/комиси/i.test(t)) return "Комисии — състав";
  return "Други решения";
}

const SUB_KINDS = ["Всички", "Комисии — състав", "Комисии — създаване", "Делегации", "Процедурни правила", "Отчети", "Край на мандати", "Вотове и оставки", "Програми", "Ваканции", "Други решения"];

export default function Aktove() {
  const [q, setQ] = useState("");
  const [year, setYear] = useState<string | null>(null);
  const [ns, setNs] = useState<string | null>(null);
  const [kind, setKind] = useState("Всички");
  const [sub, setSub] = useState("Всички");

  // actsIndex вече е сортиран: най-новите напред (ДВ година → брой → дата)
  const laws = useMemo(() => actsIndex.filter((a) => a.final || a.title), []);
  const kinds = useMemo(() => {
    const order = ["Всички", "Решения", "Нови закони", "Изменения на закони", "Ратификации", "Декларации", "Правилник на НС", "Кодекси", "Други"];
    const present = new Set(laws.map((a) => kindOf((a.final || a.title || "") as string)));
    return order.filter((k) => k === "Всички" || present.has(k));
  }, [laws]);

  const actNs = useMemo(() => {
    const m = new Map<number, string | null>();
    for (const a of laws) m.set(a.id, assemblyForDate(a.date)?.id ?? null);
    return m;
  }, [laws]);

  const yearCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of laws) {
      const y = String(a.dv_year);
      m.set(y, (m.get(y) || 0) + 1);
    }
    return [...m.entries()].sort((x, y) => y[0].localeCompare(x[0]));
  }, [laws]);

  const nsCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of laws) {
      const id = actNs.get(a.id);
      if (id) m.set(id, (m.get(id) || 0) + 1);
    }
    return [...allAssemblies]
      .filter((x) => m.has(x.id))
      .sort((x, y) => y.number - x.number)
      .map((x) => ({ asm: x, n: m.get(x.id)! }));
  }, [laws, actNs]);

  const items = laws.filter((a) => {
    const t = (a.final || a.title || "") as string;
    return (
      (!q || t.toLowerCase().includes(q.toLowerCase())) &&
      (year === null || String(a.dv_year) === year) &&
      (ns === null || actNs.get(a.id) === ns) &&
      (kind === "Всички" || kindOf(t) === kind) &&
      (kind !== "Решения" || sub === "Всички" || subKindOf(t) === sub)
    );
  });

  if (laws.length === 0) {
    return (
      <div className="max-w-2xl py-12">
        <h1 className="text-3xl font-black">Актове от 2021 насам</h1>
        <p className="mt-3 rounded-2xl border border-dashed p-6 text-sm text-zinc-500">
          ⏳ Автоматичното изброяване на всички актове от parliament.bg тече в
          момента (<code className="font-mono text-xs">scripts/enumerate-acts.mjs</code>).
          След като завърши и сайтът се прегенерира, тук ще има пълен списък на
          всеки приет закон с връзка към Държавен вестник.
        </p>
      </div>
    );
  }

  return (
    <div className="pb-10">
      <section className="py-8">
        <PageHeader
          eyebrow="Автоматичен индекс · източник: parliament.bg API"
          title={`Актове от 2021 насам (${items.length})`}
          description={`${laws.length} приети акта с брой на Държавен вестник, най-новите напред.`}
        />

        <FilterSearch value={q} onChange={setQ} placeholder="Търси в актовете: евро, ратифициране, бюджет…" />

      <FilterChipRow>
        {yearCounts.map(([y, n]) => (
          <FilterChip key={y} active={year === y} onClick={() => setYear(year === y ? null : y)}>
            {y} · {n}
          </FilterChip>
        ))}
      </FilterChipRow>

      <FilterChipRow>
        {nsCounts.map(({ asm, n }) => (
          <FilterChip key={asm.id} active={ns === asm.id} onClick={() => setNs(ns === asm.id ? null : asm.id)}>
            <span title={`${asm.years} — ${asm.ruling}`} className="inline-flex items-center gap-1.5">
              <CoalitionDots coalition={asm.coalition} />
              {asm.number}-о НС · {n}
            </span>
          </FilterChip>
        ))}
      </FilterChipRow>

      <p className="mt-2 text-[11px] text-zinc-400">
        Цветовете са на управляващите партии; сиво = служебно правителство.
      </p>

      <FilterChipRow>
        {kinds.map((k) => (
            <FilterChip key={k} active={kind === k} onClick={() => { setKind(k); setSub("Всички"); }}>
            {k}
          </FilterChip>
        ))}
      </FilterChipRow>
      <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
        {(year !== null || ns !== null || kind !== "Всички" || sub !== "Всички" || q) && (
          <button
            onClick={() => { setYear(null); setNs(null); setKind("Всички"); setSub("Всички"); setQ(""); }}
            className="underline hover:text-accent"
          >
            Изчисти филтрите ✕
          </button>
        )}
      </div>
      {kind === "Решения" && (
        <FilterChipRow>
          {SUB_KINDS.map((s) => (
            <FilterChip key={s} active={sub === s} onClick={() => setSub(s)}>
              {s}
            </FilterChip>
          ))}
        </FilterChipRow>
      )}
      </section>

      <div className="space-y-3">
        {items.slice(0, 300).map((a) => {
          const t = (a.final || a.title || "") as string;
          const det = a.detailId ?? null;
          const cardLink = det ? `/promeni/${det}` : `https://www.parliament.bg/bg/laws/ID/${a.id}`;
          const bg = (iso: string) =>
            iso
              ? new Date(iso + "T00:00:00").toLocaleDateString("bg-BG", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : "";
          const assembly = allAssemblies.find((x) => x.id === actNs.get(a.id)) ?? allAssemblies[0];
          const eyebrowLabel = a.cardShort || kindOf(t);
          const cardTitle = a.cardTitle || t;
          const cardDescription = a.cardSummary || (a.vnositel ? `Вносител: ${a.vnositel}` : undefined);
          return (
            <ActCard
              key={a.id}
              href={cardLink}
              external={!det}
              eyebrow={
                <>
                  <span className="font-bold text-zinc-900">{eyebrowLabel}</span>
                  <span>·</span>
                  <span>{a.date ? bg(a.date) : ""}</span>
                  <span>·</span>
                  <span>ДВ, бр. {a.dv_iss}/{a.dv_year}</span>
                  <span>·</span>
                  <span className="font-mono">{a.sign}</span>
                </>
              }
              title={cardTitle}
              description={cardDescription}
              assembly={assembly}
              votes={a.votes}
              missingVotesText="Гласуването се добавя — кратка справка."
            />
          );
        })}
        {items.length === 0 && (
          <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-zinc-500">
            Няма резултати. Опитай с друга дума или изчисти филтрите.
          </p>
        )}
      </div>
      {items.length > 300 && (
        <p className="mt-2 text-xs text-zinc-400">Показани са първите 300 — уточни търсенето.</p>
      )}
    </div>
  );
}
