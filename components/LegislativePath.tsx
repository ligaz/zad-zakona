import type { Amendment } from "@/lib/types";

const bg = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("bg-BG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const daysBetween = (a: string, b: string) =>
  Math.round(
    (new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) /
      86400000
  );

/** Има ли реален брой на ДВ (не „очаква се“) */
export function hasDv(a: Amendment): boolean {
  return /(\d{1,3})\/(\d{4})/.test(a.dv);
}

/** Компактно резюме за timeline възли: брой дни + има ли вето. */
export function pathSummary(a: Amendment): { days: number | null; veto: boolean } {
  const dvIso = hasDv(a) && /^\d{4}-\d{2}-\d{2}$/.test(a.dateDV ?? "") ? a.dateDV! : null;
  return {
    days: dvIso ? daysBetween(a.dateAdopted, dvIso) : null,
    veto: !!a.veto,
  };
}

/**
 * Пътят на акта: Приет → (Вето) → Указ → ДВ → В сила,
 * с брой дни между стъпките. Показва само известните стъпки.
 * Решенията на НС нямат указ за обнародване и влизат в сила с приемането.
 */
export function LegislativePath({ amendment: a }: { amendment: Amendment }) {
  const isDecision = a.lawId.startsWith("resheniya-");
  const steps: {
    key: string;
    label: string;
    date?: string;
    sub?: string;
    tone: "done" | "veto" | "pending" | "na";
  }[] = [
    { key: "adopted", label: "Приет в зала", date: a.dateAdopted, sub: a.vnositel, tone: "done" },
  ];
  if (a.veto) {
    steps.push({
      key: "veto",
      label: `Президентско вето — ${a.veto.by}`,
      date: a.veto.overridden,
      sub: `Върнат от президента ${a.veto.by} → преодоляно с повторно гласуване`,
      tone: "veto",
    });
  }
  steps.push({
    key: "decree",
    label: "Указ за обнародване",
    date: a.dateDecree,
    sub: a.decreeNo ? `Указ ${a.decreeNo}` : isDecision ? "Решенията влизат в сила без указ" : undefined,
    tone: a.dateDecree ? "done" : isDecision ? "na" : "pending",
  });
  const dvDate = hasDv(a) && a.dateDV && /^\d{4}-\d{2}-\d{2}$/.test(a.dateDV) ? a.dateDV : undefined;
  steps.push({
    key: "dv",
    label: "Обнародван в ДВ",
    date: dvDate,
    sub: a.dv,
    tone: dvDate ? "done" : "pending",
  });
  steps.push({
    key: "effective",
    label: "Влиза в сила",
    date: a.dateEffective ?? (isDecision ? a.dateAdopted : (a.dateDV ? a.dateDV : undefined)),
    sub: isDecision ? (a.dateEffective ? undefined : "с приемането") : undefined,
    tone: (a.dateEffective || (isDecision ? true : !!a.dateDV)) ? "done" : "pending",
  });

  const dated = steps.filter((s) => s.date);
  const total =
    dated.length >= 2
      ? daysBetween(dated[0].date!, dated[dated.length - 1].date!)
      : null;
  const speed =
    total === null
      ? null
      : total <= 7
        ? "⚡ експресно"
        : total <= 30
          ? "стандартно"
          : "🐌 забавено";

  return (
    <div>
      <ol>
        {steps.map((s, i) => {
          const prev = steps
            .slice(0, i)
            .reverse()
            .find((x) => x.date);
          const gap = s.date && prev?.date ? daysBetween(prev.date, s.date) : null;
          const isLast = i === steps.length - 1;
          return (
            <li key={s.key} className="relative flex gap-3 pb-4 last:pb-0">
              <span className="relative w-3.5 shrink-0 self-stretch" aria-hidden="true">
                <span
                  className={`absolute left-1/2 top-0 w-0.5 -translate-x-1/2 bg-zinc-200 dark:bg-zinc-700 ${
                    isLast ? "bottom-0" : "-bottom-4"
                  }`}
                />
                <span
                  className={`absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow dark:border-zinc-900 ${
                    s.tone === "veto"
                      ? "bg-rose-500"
                      : s.tone === "done"
                        ? "bg-emerald-500"
                        : s.tone === "na"
                          ? "bg-zinc-400"
                          : "bg-zinc-300"
                  }`}
                />
              </span>
              <div
                className={`flex min-h-[64px] flex-1 flex-col justify-center rounded-xl border px-3 py-2 ${
                  s.tone === "veto"
                    ? "border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/50"
                    : s.tone === "pending" || s.tone === "na"
                      ? "border-dashed border-zinc-200 bg-zinc-50/50 dark:border-zinc-700 dark:bg-zinc-900/50"
                      : "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
                }`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className={`text-sm font-bold ${s.tone === "veto" ? "text-rose-700 dark:text-rose-300" : s.tone === "pending" || s.tone === "na" ? "text-zinc-400 dark:text-zinc-500" : "text-zinc-900 dark:text-zinc-100"}`}>
                    {s.tone === "veto" ? "🔴 " : ""}{s.label}
                  </p>
                  <p className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                    {s.date ? bg(s.date) : "—"}
                    {gap !== null && gap > 0 && (
                      <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 font-semibold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                        +{gap} {gap === 1 ? "ден" : "дни"}
                      </span>
                    )}
                    {gap === 0 && (
                      <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 font-semibold text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                        същия ден
                      </span>
                    )}
                  </p>
                </div>
                {s.sub && (
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {s.sub}{" "}
                    {s.key === "veto" && a.veto?.motivesUrl && (
                      <a
                        href={a.veto.motivesUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-rose-700 underline hover:text-rose-900 dark:text-rose-300 dark:hover:text-rose-200"
                      >
                        Мотивите на президента →
                      </a>
                    )}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {total !== null && (
        <p className="mt-3 rounded-xl bg-accent px-3 py-2 text-center text-xs font-semibold text-white">
          От гласуване до {dated[dated.length - 1].key === "effective" ? "влизане в сила" : dated[dated.length - 1].label.toLowerCase()}:{" "}
          {total} {total === 1 ? "ден" : "дни"} · {speed}
        </p>
      )}
    </div>
  );
}
