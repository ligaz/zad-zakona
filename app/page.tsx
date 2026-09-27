"use client";

import { useState } from "react";
import Link from "next/link";
import { assemblyById, feedItems, laws, actsIndex, visibleAmendments, visibleLaws } from "@/lib/data";
import { ActCard } from "@/components/Viz";

const bg = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("bg-BG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export default function Home() {
  const [shown, setShown] = useState(10);

  const lawById = Object.fromEntries(laws.map((l) => [l.id, l]));

  const items = feedItems;

  return (
    <div className="pb-10">
      {/* HERO */}
      <section className="py-10 text-center sm:py-14">
        <h1 className="mx-auto mt-4 max-w-2xl text-4xl font-black tracking-tight sm:text-5xl">
          Всеки закон има история. <br className="hidden sm:block" />
          <span className="text-zinc-500">Ние я показваме.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-zinc-600">
          Като дневник на държавата: какво се промени, защо, кой гласува „за“ и кой управляваше тогава —
          обяснено на разбираем език.
        </p>
      </section>

      {/* ЗАКОНИ + АКТОВЕ — една до друга */}
      <section className="mt-2 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-accent p-5 text-zinc-100 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-200">
            Всички закони · по азбучен ред
          </p>
          <p className="mt-1 text-2xl font-black">
            {visibleLaws.length} закона · {visibleAmendments.length} изменения
          </p>
          <Link
            href="/zakoni"
            className="mt-4 inline-block rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-accent hover:bg-zinc-200"
          >
            Всички закони →
          </Link>
        </div>
        <div className="rounded-2xl bg-accent p-5 text-zinc-100 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-200">
            Всички актове от 2021 насам
          </p>
          <p className="mt-1 text-2xl font-black">
            {actsIndex.length} акта · всички с детайли
          </p>
          <Link
            href="/aktove"
            className="mt-4 inline-block rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-accent hover:bg-zinc-200"
          >
            Всички актове →
          </Link>
        </div>
      </section>

      {/* FEED */}
      <section className="mt-10">
        <h2 className="text-xl font-extrabold">
          Последни промени <span className="font-normal text-zinc-400">({items.length})</span>
        </h2>
        <div className="mt-4 space-y-3">
          {items.slice(0, shown).map((a) => {
            const law = lawById[a.lawId];
            return (
              <ActCard
                key={a.id}
                href={`/promeni/${a.id}`}
                eyebrow={
                  <>
                    <span className="font-bold text-zinc-900">{law.short}</span>
                    <span>·</span>
                    <span>{bg(a.dateAdopted)}</span>
                    <span>·</span>
                    <span>{a.dv}</span>
                    {a.verified && <span className="font-semibold text-emerald-600">✓</span>}
                  </>
                }
                title={a.shortTitle}
                description={a.summary}
                assembly={assemblyById(a.assemblyId)}
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
          {items.length > shown && (
            <button
              onClick={() => setShown((s) => s + 50)}
              className="w-full rounded-2xl border border-zinc-300 p-3 text-sm font-bold text-zinc-700 hover:border-accent"
            >
              Покажи още ({items.length - shown} остават)
            </button>
          )}
        </div>
      </section>

      {/* КАК РАБОТИ */}
      <section className="mt-12 grid gap-3 sm:grid-cols-3">
        {[
          ["📜", "Какво се промени", "Diff преди/след по членове + обяснение на прост език."],
          ["🗳️", "Кой гласува", "За/против по партии — кой подкрепи и кой се опъна."],
          ["🏛️", "Кой управляваше", "Кое НС, кое правителство и кой премиер стоят зад промяната."],
        ].map(([e, t, d]) => (
          <div key={t} className="rounded-2xl bg-zinc-50 p-4">
            <p className="text-2xl">{e}</p>
            <p className="mt-1 font-bold">{t}</p>
            <p className="mt-1 text-sm text-zinc-600">{d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
