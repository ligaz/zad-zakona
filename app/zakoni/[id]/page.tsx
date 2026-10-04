import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { amendmentById, assemblies, assemblyById, laws } from "@/lib/data";
import { SITE_URL } from "@/lib/site";
import { ContextBadge, VoteBar } from "@/components/Viz";
import { pathSummary } from "@/components/LegislativePath";
import { CoalitionDots } from "@/components/CoalitionDots";

export function generateStaticParams() {
  return laws.map((l) => ({ id: l.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const law = laws.find((l) => l.id === id);
  if (!law) return {};
  const title = `${law.name} — история на измененията`;
  const description = `${law.description} Всички ${law.amendments.length} изменения с гласувания и контекст.`;
  return {
    title,
    description,
    alternates: { canonical: `/zakoni/${law.id}` },
    openGraph: {
      type: "article",
      url: `/zakoni/${law.id}`,
      title,
      description,
      images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: title }],
    },
    twitter: { card: "summary_large_image", title, description, images: ["/opengraph-image"] },
    keywords: [law.name, law.short, law.category],
  };
}

const bg = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("bg-BG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export default async function LawPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const law = laws.find((l) => l.id === id);
  if (!law) notFound();
  const items = law.amendments
    .map((aid) => amendmentById(aid)!)
    .filter(Boolean)
    .sort((a, b) => String(b.dateAdopted || "").localeCompare(String(a.dateAdopted || "")));

  return (
    <div className="pb-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: `${law.name} — история на измененията`,
            description: law.description,
            inLanguage: "bg",
            url: `${SITE_URL}/zakoni/${law.id}`,
          }),
        }}
      />
      <p className="pt-6 text-sm text-zinc-500 dark:text-zinc-400">
        <Link href="/" className="hover:underline">Начало</Link>
        {" · "}
        <Link href="/zakoni" className="hover:underline">Закони</Link>
      </p>
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
        {law.category} · Първо приет {law.firstAdopted} г.
      </p>
      <h1 className="mt-1 break-words text-3xl font-black tracking-tight sm:text-4xl">{law.name}</h1>
      <p className="mt-2 max-w-2xl text-zinc-600 dark:text-zinc-400">{law.description}</p>
      <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
        <b className="text-zinc-900 dark:text-zinc-100">{items.length} изменения</b> за последните 20 години ·
        най-ново: {bg(items[0].dateAdopted)} ·
        <span className="font-medium text-emerald-700 dark:text-emerald-400"> ✓ {items.filter((x) => x.verified).length} сверени с ДВ</span>
      </p>

      {/* TIMELINE */}
      <div className="relative mt-8 space-y-0 border-l-2 border-zinc-200 dark:border-zinc-700 pl-0">
        {items.map((a, i) => {
          const asm = assemblyById(a.assemblyId);
          return (
            <div key={a.id} className="relative pb-6 pl-8">
              <span className="absolute -left-[7px] top-5 flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow">
                <CoalitionDots coalition={asm.coalition} size="h-2.5 w-2.5" />
              </span>
              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500 dark:text-zinc-400">
                {new Date(a.dateAdopted + "T00:00:00").getFullYear()} · {a.dv}
              </div>
              <Link
                href={`/promeni/${a.id}`}
                className="mt-1 block rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 transition hover:border-accent hover:shadow-sm sm:p-5"
              >
                <h2 className="break-words text-lg font-bold leading-snug">{a.shortTitle}</h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{a.summary}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <ContextBadge assembly={asm} />
                  <span className="inline-flex items-center rounded-full bg-zinc-100 dark:bg-zinc-700 px-2.5 py-0.5 text-xs text-zinc-600 dark:text-zinc-300">
                    Вносител: {a.vnositel}
                  </span>
                </div>
                <div className="mt-3 max-w-lg">
                  {a.votes ? (
                    <VoteBar votes={a.votes} compact />
                  ) : (
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 dark:text-zinc-400">Гласуването се добавя.</p>
                  )}
                </div>
                <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500 dark:text-zinc-400">
                  {(a.changedMembers ?? []).length > 0
                    ? `${a.changedMembers!.length} засегнати члена`
                    : `${a.changes.length} променени члена`}
                  {a.votes ? ` · ${a.votes.za} за / ${a.votes.protiv} против` : ""}
                  {" →"}
                </p>
                {(() => {
                  const s = pathSummary(a);
                  return (
                    <p className="mt-1.5 text-xs">
                      <span className="rounded-full bg-zinc-100 dark:bg-zinc-700 px-2 py-0.5 font-medium text-zinc-600 dark:text-zinc-300">
                        ⏱ {s.days !== null ? `${s.days} ${s.days === 1 ? "ден" : "дни"} до ДВ` : "ДВ предстои"}
                      </span>{" "}
                      {s.veto && (
                        <span className="rounded-full bg-rose-50 dark:bg-rose-950 px-2 py-0.5 font-semibold text-rose-700 dark:text-rose-300">
                          🔴 вето
                        </span>
                      )}
                    </p>
                  );
                })()}
              </Link>
              {i === 0 && (
                <p className="mt-2 inline-block rounded-full bg-emerald-50 dark:bg-emerald-950 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                  ● действаща версия
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* КОНТЕКСТ ЛЕНТА */}
      <section className="mt-8 rounded-2xl bg-zinc-50 dark:bg-zinc-900 p-4 sm:p-5">
        <h2 className="font-bold">Кой управляваше при тези промени?</h2>
        <div className="mt-3 space-y-2">
          {Array.from(new Set(items.map((a) => a.assemblyId))).map((aid) => {
            const asm = assemblies.find((x) => x.id === aid)!;
            const n = items.filter((a) => a.assemblyId === aid).length;
            return (
              <div key={aid} className="flex items-center gap-3 text-sm">
                <CoalitionDots coalition={asm.coalition} size="h-3 w-3" />
                <span>
                  <b>{asm.number}-о НС</b> ({asm.years}) — {asm.ruling}
                  <span className="text-zinc-500 dark:text-zinc-400"> · {n} {n === 1 ? "промяна" : "промени"} на този закон</span>
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
