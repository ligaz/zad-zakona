import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { amendmentById, amendments, assemblyById, laws } from "@/lib/data";
import { SITE_URL } from "@/lib/site";
import { ContextBadge } from "@/components/Viz";
import { LegislativePath } from "@/components/LegislativePath";
import { ParliamentChart } from "@/components/ParliamentChart";

export function generateStaticParams() {
  return amendments.map((a) => ({ id: a.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const a = amendmentById(id);
  if (!a) return {};
  const law = laws.find((l) => l.id === a.lawId);
  const title = `${a.shortTitle} — ${a.dv}`;
  const description = a.summary;
  return {
    title,
    description,
    alternates: { canonical: `/promeni/${a.id}` },
    openGraph: {
      type: "article",
      url: `/promeni/${a.id}`,
      title,
      description,
      images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: title }],
    },
    twitter: { card: "summary_large_image", title, description, images: ["/opengraph-image"] },
    ...(law ? { keywords: [law.name, law.short, a.dv] } : {}),
  };
}

const bg = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("bg-BG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export default async function AmendmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = amendmentById(id);
  if (!a) notFound();
  const law = laws.find((l) => l.id === a.lawId)!;
  const asm = assemblyById(a.assemblyId);

  return (
    <div className="pb-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Legislation",
            name: a.shortTitle,
            description: a.summary,
            inLanguage: "bg",
            url: `${SITE_URL}/promeni/${a.id}`,
            datePublished: a.dateDV ?? a.dateAdopted,
            legislationIdentifier: a.dv,
            legislationJurisdiction: { "@type": "Country", name: "България" },
          }),
        }}
      />
      <p className="pt-6 text-sm text-zinc-500">
        <Link href="/" className="hover:underline">← Начало</Link>
        {" · "}
        <Link href={`/zakoni/${law.id}`} className="hover:underline">{law.name} — всички изменения</Link>
      </p>

      <p className="mt-4 text-xs text-zinc-500">
        {law.short} · Прието {bg(a.dateAdopted)} · {a.dv}
      </p>
      <h1 className="mt-1 break-words text-3xl font-black tracking-tight">{a.shortTitle}</h1>
      {a.fullTitle && a.fullTitle !== a.shortTitle && (
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">{a.fullTitle}</p>
      )}
      <p className="mt-2 max-w-2xl text-sm text-zinc-600">{a.summary}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {a.verified && a.detailLevel === "full" ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
            ✓ Проверено по Държавен вестник
          </span>
        ) : a.verified ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
            ✓ Сверено с официалния текст
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
            Илюстративни данни — предстои сверка
          </span>
        )}
        {a.detailLevel === "basic" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-700">
            Кратка справка — пълният детайл се подготвя
          </span>
        )}
        <ContextBadge assembly={asm} />
        {a.tags.map((t) => (
          <span key={t} className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-600">#{t}</span>
        ))}
      </div>

      {a.sources && (a.sources.dv || a.sources.bill || (a.sources.news ?? []).length > 0) && (
        <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-600">
          <p className="font-bold text-zinc-800">Източници</p>
          <ul className="mt-1 space-y-1">
            {a.sources.dv && (
              <li>📕 <a href={a.sources.dv} target="_blank" rel="noreferrer" className="underline hover:text-accent">Държавен вестник — {a.dv}</a></li>
            )}
            {a.sources.bill && (
              <li>📄 <a href={a.sources.bill} target="_blank" rel="noreferrer" className="underline hover:text-accent">Законопроект {a.billSignatura ?? ""} (parliament.bg)</a></li>
            )}
            {(a.sources.news ?? []).map((n) => (
              <li key={n}>📰 <a href={n} target="_blank" rel="noreferrer" className="underline hover:text-accent">{new URL(n).hostname}</a></li>
            ))}
          </ul>
        </div>
      )}
      {a.stenogramLink && (
        <div className="mt-3">
          <a
            href={a.stenogramLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:border-accent"
          >
            🏛️ Стенограма от заседанието + поименно гласуване →
          </a>
        </div>
      )}

      {/* ПЪТЯТ НА ЗАКОНА */}
      <section className="mt-8">
        <h2 className="text-xl font-extrabold">
          ⏱️ {a.lawId.startsWith("resheniya-") ? "Пътят на решението" : "Пътят на закона"}
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          От гласуването до влизането в сила — включително президентско вето, ако е имало.
        </p>
        <div className="mt-3 rounded-2xl border border-zinc-200 p-4 sm:p-5">
          <LegislativePath amendment={a} />
        </div>
      </section>

      {/* 1. КАКВО СЕ ПРОМЕНИ */}
      {(a.changes.length > 0 || (a.changedMembers ?? []).length > 0) && (
      <section className="mt-8">
        <h2 className="text-xl font-extrabold">📜 Какво се промени</h2>
        {a.changes.length === 0 && (a.changedMembers ?? []).length > 0 && (
          <div className="mt-3 rounded-2xl border border-dashed border-zinc-300 p-4 sm:p-5">
            <p className="text-sm text-zinc-600">
              Засегнати членове:{" "}
              {(a.changedMembers ?? []).map((m) => (
                <code key={m} className="mr-1.5 rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs">{m}</code>
              ))}
            </p>
            <p className="mt-2 text-xs text-zinc-400">
              Подробното сравнение „преди/сега“ и обяснението на прост език се подготвят. Официалният текст е в {a.dv}.
            </p>
          </div>
        )}
        <div className="mt-3 space-y-3">
          {a.changes.map((c) => (
            <div key={c.member} className="overflow-hidden rounded-2xl border border-zinc-200">
              <p className="border-b border-zinc-100 bg-zinc-50 px-4 py-2 text-sm font-bold">{c.member}</p>
              {c.before ? (
                <div className="grid sm:grid-cols-2">
                  <div className="border-b border-zinc-100 bg-rose-50/60 p-4 sm:border-b-0 sm:border-r">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-rose-600">Преди ✕</p>
                    <p className="mt-1 text-sm text-zinc-700">{c.before}</p>
                  </div>
                  <div className="bg-emerald-50/60 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-600">Сега ✓</p>
                    <p className="mt-1 text-sm text-zinc-700">{c.after}</p>
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-50/60 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-600">Сега ✓</p>
                  <p className="mt-1 text-sm text-zinc-700">{c.after}</p>
                </div>
              )}
              <p className="bg-white px-4 py-3 text-sm">
                <span className="font-semibold">С прости думи: </span>{c.plain}
              </p>
            </div>
          ))}
        </div>
      </section>
      )}

      {/* 2. ЗАЩО */}
      <section className="mt-8 rounded-2xl border border-zinc-200 p-4 sm:p-5">
        <h2 className="text-xl font-extrabold">💬 Защо — мотиви на вносителя</h2>
        {(a.vnositel || a.motives) ? (
          <>
            {a.vnositel && (
              <p className="mt-1 text-xs text-zinc-500">
                Вносител: <b className="text-zinc-800">{a.vnositel}</b>
                {a.billSignatura ? ` · Номер на законопроекта ${a.billSignatura}` : ""}
              </p>
            )}
            {a.motives && (
              <p className="mt-3 text-sm leading-relaxed text-zinc-700">{a.motives}</p>
            )}
          </>
        ) : (
          <p className="mt-2 text-sm text-zinc-500">
            Мотивите на вносителя се извличат от законопроекта — предстои добавяне.
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="w-full text-zinc-400">Къде да провериш:</span>
          {a.billUrl ? (
            <a
              href={a.billUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-zinc-300 px-3 py-1 font-medium text-zinc-700 hover:border-accent"
            >
              📄 Законопроектът и мотивите →
            </a>
          ) : a.sources?.bill ? (
            <a
              href={a.sources.bill}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-zinc-300 px-3 py-1 font-medium text-zinc-700 hover:border-accent"
            >
              📄 Страницата на закона →
            </a>
          ) : null}
          {a.sources?.dv ? (
            <a
              href={a.sources.dv}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-zinc-300 px-3 py-1 font-medium text-zinc-700 hover:border-accent"
            >
              📕 Държавен вестник — {a.dv} →
            </a>
          ) : (
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-zinc-500">
              📕 {a.dv}
            </span>
          )}
        </div>
      </section>

      {/* 3. КОЙ ГЛАСУВА */}
      <section className="mt-8">
        <h2 className="text-xl font-extrabold">🗳️ Кой гласува</h2>
        <div className="mt-3 rounded-2xl border border-zinc-200 p-4 sm:p-5">
          {a.votes ? (
            <>
                <ParliamentChart
                  groups={
                    (a.votesByParty ?? []).length > 0
                      ? a.votesByParty ?? []
                      : [{ party: "", za: a.votes.za, protiv: a.votes.protiv, vazdrzhal: a.votes.vazdrzhal }]
                  }
                  colorBy={(a.votesByParty ?? []).length > 0 ? "party" : "vote"}
                  assemblyId={a.assemblyId}
                />
              {a.votesNote && (
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{a.votesNote}</p>
              )}
            </>
          ) : (
            <p className="text-sm text-zinc-500">
              Гласуването се извлича от стенограмата на пленарната зала — предстои добавяне.
            </p>
          )}
        </div>
      </section>

      {/* 4. КОНТЕКСТ */}
      <section className="mt-8 rounded-2xl bg-accent p-4 text-zinc-100 sm:p-6">
        <h2 className="text-xl font-extrabold">🏛️ Политически контекст</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-zinc-400">Народно събрание</dt><dd className="font-semibold">{asm.number}-о НС ({asm.years})</dd></div>
          <div><dt className="text-zinc-400">Управление</dt><dd className="font-semibold">{asm.ruling}</dd></div>
          <div><dt className="text-zinc-400">Премиер</dt><dd className="font-semibold">{asm.primeMinister}</dd></div>
          <div><dt className="text-zinc-400">Президент</dt><dd className="font-semibold">{asm.president}</dd></div>
        </dl>
        <p className="mt-3 text-xs text-zinc-400">
          Коалиция: {asm.coalition.join(" · ")}{a.votes ? ` · Гласували „за“: ${a.votes.za} от 240` : ""}
        </p>
      </section>
    </div>
  );
}
