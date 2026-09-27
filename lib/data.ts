import type { Amendment, Assembly, Law } from "./types";
import { HIDDEN_LAW_IDS } from "./types";
import assembliesJson from "../data/assemblies.json";
import lawsJson from "../data/laws.json";
import amendmentsJson from "../data/amendments.json";
import actsIndexJson from "../data/acts-index.json";

export interface ActEntry {
  id: number;
  type: number;
  title: string | null;
  final: string | null;
  date: string | null;
  sign: string | null;
  dv_iss: string | null;
  dv_year: number | null;
  dv_idmat: number | null;
  /** истински idMat на материала в ДВ (null = несверен; dv_idmat е ID на броя) */
  dv_mat?: number | null;
  votes?: { za: number; protiv: number; vazdrzhal: number };
  votesByParty?: { party: string; za: number; protiv: number; vazdrzhal: number }[];
  votesVerified?: boolean | "partial";
  stenogramLink?: string;
  vnositel?: string;
  vnositelType?: "МС" | "депутати";
  /** Курирана детайлна страница, ако има (напр. "act-167207"); null = само външна връзка. */
  detailId?: string | null;
  /** Леки полета за картичката (от курирания детайл, за да не се товари amendments.json). */
  cardShort?: string | null;
  cardTitle?: string | null;
  cardSummary?: string | null;
}

/**
 * Данните живеят като JSON в /data (статичен сайт, без база).
 * Седмично обновяване: scripts/check-dv.mjs + ръчна проверка → git push → rebuild.
 */
export const assemblies: Assembly[] = assembliesJson as Assembly[];
export const laws: Law[] = lawsJson as Law[];
export const amendments: Amendment[] = amendmentsJson as Amendment[];

/**
 * Групи решения/ратификации — не са закони и не се показват в /zakoni.
 * Единствен източник на истината: ползват го и началната страница, и /zakoni.
 * (Сетът живее в lib/types.ts, за да не дърпа тежки данни в клиентския bundle.)
 */
export { HIDDEN_LAW_IDS };

/** Закони за показване в /zakoni и броене на началната страница. */
export const visibleLaws: Law[] = laws.filter((l) => !HIDDEN_LAW_IDS.has(l.id));

/** Изменения към видимите закони — броят в кутията на началната = сумата в /zakoni. */
export const visibleAmendments: Amendment[] = amendments.filter(
  (a) => !HIDDEN_LAW_IDS.has(a.lawId)
);

export const assemblyById = (id: string): Assembly =>
  assemblies.find((a) => a.id === id) ?? assemblies[0];

/** Кое НС е било активно на дадена дата (по дата на приемане). */
export function assemblyForDate(iso: string | null): Assembly | null {
  if (!iso) return null;
  const d = iso.slice(0, 10);
  return (
    assemblies.find(
      (a) => a.from && d >= a.from && (!a.to || d <= a.to)
    ) ?? null
  );
}

export const amendmentById = (id: string) =>
  amendments.find((a) => a.id === id);

export const verifiedCount = amendments.filter((a) => a.verified).length;

export const lawsWithCounts = laws.map((l) => ({
  ...l,
  count: l.amendments.length,
  verified: l.amendments.filter((id) => amendmentById(id)?.verified).length,
  lastAmendment: amendmentById(l.amendments[0]),
}));

export const feedItems = [...amendments].sort((a, b) =>
  String(b.dateAdopted || "").localeCompare(String(a.dateAdopted || ""))
);

/** Пълен автоматичен индекс (parliament.bg API) — винаги НОВИТЕ НАПРЕД. */
const numIss = (s: string | null) => {
  const m = (s || "").match(/\d+/);
  return m ? Number(m[0]) : 0;
};
export const actsIndex: ActEntry[] = (actsIndexJson as ActEntry[])
  .filter((a) => a.dv_iss && a.dv_year && a.dv_year >= 2021)
  .sort(
    (a, b) =>
      (b.dv_year ?? 0) - (a.dv_year ?? 0) ||
      numIss(b.dv_iss) - numIss(a.dv_iss) ||
      (b.date ?? "").localeCompare(a.date ?? "") ||
      b.id - a.id
  );

export const actsDetailedKeys = new Set(
  amendments
    .map((a) => {
      const m = a.dv.match(/(\d{1,3})\/(\d{4})/);
      return m ? `${m[2]}-${m[1]}` : null;
    })
    .filter(Boolean) as string[]
);

/** Точно съвпадение акт → курирано изменение (по bill ID от parliament.bg). */
export const actsDetailByBill = new Map(
  amendments.flatMap((a) => {
    const urls = [a.billUrl ?? "", a.sources?.bill ?? ""];
    for (const u of urls) {
      const m = u.match(/\/ID\/(\d+)/);
      if (m) return [[m[1], a.id] as [string, string]];
    }
    return [];
  })
);
