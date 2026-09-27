/**
 * Цветове на партиите — собствена палитра на сайта (контрастна):
 * ГЕРБ–синьо, БСП–червено, ДПС–тъмносиньо, ПП–жълто, ДБ–тъмносиньо,
 * НДСВ–жълто, ИТН–светлосиньо, Възраждане–тъмнозелено,
 * АПС–лилаво, МЕЧ–червено.
 * За нови формации (Прогресивна България) цветът е редакционен и подлежи на смяна.
 */

export const PARTY_COLORS: Record<string, string> = {
  "ГЕРБ": "#0c4587",
  "СДС": "#1E40AF",
  "БСП": "#D22630",
  "КБ": "#D22630",
  "БСПЛБ": "#D22630",
  "ДПС": "#0160aa",
  "НДСВ": "#EAB308",
  "ПП": "#ffc300",
  "Продължаваме промяната": "#ffc300",
  "ПП-ДБ": "#0014ff",
  "ДБ": "#1E3A8A",
  "Демократична България": "#1E3A8A",
  "ИТН": "#4cb7de",
  "Възраждане": "#1e452e",
  "ВМРО": "#991B1B",
  "НФСБ": "#4B5563",
  "Атака": "#005f3b",
  "Реформаторски блок": "#2563EB",
  "АБВ": "#6D28D9",
  "Прогресивна България": "#0D9488", // редакционен, подлежи на смяна
  "ПБ": "#0D9488", // редакционен, подлежи на смяна
  "ПФ": "#991B1B",
  "РБ": "#2563EB",
  "БДЦ": "#A16207",
  "АПС": "#9966cc",
  "МЕЧ": "#cb5b0c",
  "Величие": "#c13335",
  "БВ": "#94A3B8",
};

const FALLBACK = "#9CA3AF";

/** Разгъване на известни коалиции до партии-членки за точни точки. */
const EXPAND: Record<string, string[]> = {
  "ГЕРБ-СДС": ["ГЕРБ", "СДС"],
  "ПП-ДБ": ["ПП", "ДБ"],
  "БСП-Обединена левица": ["БСП"],
  "ДПС-Ново начало": ["ДПС"],
  "ДПС-НН": ["ДПС"],
  "Обединени патриоти": ["ВМРО", "НФСБ", "Атака"],
  "Патриотичен фронт": ["ВМРО", "НФСБ"],
};

export function coalitionParties(coalition: string[]): string[] {
  if (coalition.length === 1 && coalition[0] === "—") return [];
  return coalition.flatMap((c) => EXPAND[c] ?? [c]);
}

export function partyColor(party: string): string {
  const clean = party.replace(/\s+/g, " ").trim();
  if (PARTY_COLORS[clean]) return PARTY_COLORS[clean];
  const nospace = clean.replace(/ - /g, "-");
  if (PARTY_COLORS[nospace]) return PARTY_COLORS[nospace];
  // съставни имена: цветът на първата разпозната партия ("ГЕРБ-СДС" → ГЕРБ)
  for (const part of nospace.split("-")) {
    if (PARTY_COLORS[part]) return PARTY_COLORS[part];
  }
  return FALLBACK;
}

/**
 * Разположение в залата, отляво надясно (гледано от председателя).
 * Правило: БСП — ляво; Възраждане, ИТН, ДБ — дясно; ГЕРБ, ПП — център/дясно.
 * Може да се предефинира за конкретно НС чрез ASSEMBLY_SEATS.
 */
const SEAT_ORDER: Record<string, number> = {
  "БСП": 10, "КБ": 11, "БСПЛБ": 12, "АБВ": 13, "АПС": 14,
  "Прогресивна България": 20, "ПБ": 20,
  "НДСВ": 30, "ДПС": 31,
  "ГЕРБ": 40, "СДС": 41,
  "ПП": 42, "Продължаваме промяната": 42,
  "ИТН": 50,
  "ДБ": 51, "Демократична България": 51,
  "Реформаторски блок": 52, "РБ": 52,
  "ВМРО": 60, "НФСБ": 61, "Атака": 62,
  "Възраждане": 70,
};

/** Предефиниции по НС (assemblyId → party → позиция). Празно = важи глобалното. */
const ASSEMBLY_SEATS: Record<string, Record<string, number>> = {
};

export function seatOrder(party: string, assemblyId?: string): number {
  const clean = party.replace(/\s+/g, " ").trim();
  if (assemblyId && ASSEMBLY_SEATS[assemblyId]?.[clean] !== undefined) {
    return ASSEMBLY_SEATS[assemblyId][clean];
  }
  if (SEAT_ORDER[clean] !== undefined) return SEAT_ORDER[clean];
  const nospace = clean.replace(/ - /g, "-");
  if (SEAT_ORDER[nospace] !== undefined) return SEAT_ORDER[nospace];
  for (const part of nospace.split("-")) {
    if (SEAT_ORDER[part] !== undefined) return SEAT_ORDER[part];
  }
  return 90; // непознати/независими — най-вдясно в края
}
