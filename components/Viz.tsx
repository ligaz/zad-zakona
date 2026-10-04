import type { ReactNode } from "react";
import Link from "next/link";
import type { Amendment, Assembly } from "@/lib/types";
import { CoalitionDots } from "./CoalitionDots";

/** Re-export за съвместимост — каноничното място е components/Filters.tsx. */
export { FilterChip } from "./Filters";

/** Обща заглавна секция на списъчните страници — еднакъв стил и отстояния. */
export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description: string;
}) {
  return (
    <>
      {eyebrow && (
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">{eyebrow}</p>
      )}
      <h1 className={`${eyebrow ? "mt-1 " : ""}text-3xl font-black tracking-tight dark:text-white`}>{title}</h1>
      <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
    </>
  );
}

const HALL = 240;

export function VoteBar({ votes, compact = false }: { votes: { za: number; protiv: number; vazdrzhal: number }; compact?: boolean }) {
  const { za, protiv, vazdrzhal } = votes;
  const voted = za + protiv + vazdrzhal;
  const pct = (n: number) => `${(n / HALL) * 100}%`;
  return (
    <div>
      <div
        className="flex h-3 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-700"
        title={`Зала от ${HALL}: ${za} за, ${protiv} против, ${vazdrzhal} въздържали се, ${HALL - voted} негласували`}
      >
        <div className="bg-emerald-500" style={{ width: pct(za) }} />
        <div className="bg-rose-500" style={{ width: pct(protiv) }} />
        <div className="bg-zinc-400" style={{ width: pct(vazdrzhal) }} />
      </div>
      {!compact && (
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-600 dark:text-zinc-400">
          <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" />За: <b className="text-zinc-900 dark:text-zinc-100">{za}</b></span>
          <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-rose-500" />Против: <b className="text-zinc-900 dark:text-zinc-100">{protiv}</b></span>
          <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-zinc-400" />Въздържали се: <b className="text-zinc-900 dark:text-zinc-100">{vazdrzhal}</b></span>
          <span className="text-zinc-400 dark:text-zinc-500">Гласували {voted} от {HALL} ({Math.round((voted / HALL) * 100)}%)</span>
        </div>
      )}
    </div>
  );
}

export function ActCard({
  href,
  external = false,
  eyebrow,
  title,
  description,
  assembly,
  votes,
  missingVotesText,
}: {
  href: string;
  external?: boolean;
  eyebrow: ReactNode;
  title: string;
  description?: string;
  assembly: Assembly;
  votes?: { za: number; protiv: number; vazdrzhal: number };
  missingVotesText: string;
}) {
  return (
    <Link
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className="block rounded-2xl border border-zinc-200 bg-white p-4 transition hover:border-accent dark:border-zinc-700 dark:bg-zinc-900 sm:p-5"
    >
      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">{eyebrow}</div>
      <h3 className="mt-1.5 break-words text-lg font-bold leading-snug dark:text-white">{title}</h3>
      {description ? <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{description}</p> : null}
      <div className="mt-3">
        <ContextBadge assembly={assembly} />
      </div>
      <div className="mt-3 max-w-md">
        {votes ? (
          <>
            <VoteBar votes={votes} compact />
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {votes.za} за · {votes.protiv} против · {votes.vazdrzhal} въздържали се
            </p>
          </>
        ) : (
          <p className="text-xs text-zinc-400 dark:text-zinc-500">{missingVotesText}</p>
        )}
      </div>
    </Link>
  );
}

export function ContextBadge({ assembly: a }: { assembly: Assembly }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 bg-zinc-50 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
      title={`${a.number}-о НС (${a.years}) — ${a.ruling}; премиер: ${a.primeMinister}; президент: ${a.president}`}
    >
      <CoalitionDots coalition={a.coalition} />
      {a.number}-о НС · {a.ruling}
    </span>
  );
}

export function PartyBreakdown({ amendment }: { amendment: Amendment }) {
  const list = amendment.votesByParty ?? [];
  if (!list.length) {
    return (
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Поименно разпределение по партии — предстои добавяне от стенограмата.
      </p>
    );
  }
  // ширина на лентата = тежест на групата (спрямо най-голямата), не еднаква за всички
  const maxVoted = Math.max(...list.map((p) => p.za + p.protiv + p.vazdrzhal), 1);
  return (
    <div className="space-y-2.5">
      {list.map((p) => {
        const voted = p.za + p.protiv + p.vazdrzhal;
        const widthPct = Math.max((voted / maxVoted) * 100, voted > 0 ? 3 : 0);
        return (
          <div key={p.party}>
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="truncate font-medium text-zinc-700 dark:text-zinc-300">{p.party}</span>
              <span className="shrink-0 tabular-nums text-zinc-500 dark:text-zinc-400">
                <b className="text-zinc-900 dark:text-zinc-100">{voted}</b> гласа · {p.za}/{p.protiv}/{p.vazdrzhal}
              </span>
            </div>
            <div
              className="mt-1 flex h-2.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-700"
              title={`${p.party}: ${p.za} за, ${p.protiv} против, ${p.vazdrzhal} въздържали се (${voted} от ${HALL} в залата)`}
            >
              <div className="flex h-full overflow-hidden rounded-full" style={{ width: `${widthPct}%` }}>
                <div className="h-full bg-emerald-500" style={{ width: `${voted ? (p.za / voted) * 100 : 0}%` }} />
                <div className="h-full bg-rose-500" style={{ width: `${voted ? (p.protiv / voted) * 100 : 0}%` }} />
                <div className="h-full bg-zinc-400" style={{ width: `${voted ? (p.vazdrzhal / voted) * 100 : 0}%` }} />
              </div>
            </div>
          </div>
        );
      })}
      <p className="text-[11px] text-zinc-400 dark:text-zinc-500">Дължината е пропорционална на гласовете на групата (най-голямата е пълна); формат: за / против / въздържали се{amendment.votesVerified === false || amendment.votesVerified === "partial" ? " · разпределението е частично и предстои сверка" : ""}</p>
    </div>
  );
}
