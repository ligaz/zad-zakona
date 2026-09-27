export interface Assembly {
  id: string; // "51-ns"
  number: number; // 51
  years: string; // "2024–2025"
  ruling: string; // кратко: "ГЕРБ–БСП–ИТН (Желязков)"
  coalition: string[];
  primeMinister: string;
  president: string;
  color: string; // hex за timeline лентата
  /** Точни дати на мандата (ISO); to: null = действащо */
  from?: string | null;
  to?: string | null;
}

export interface PartyVote {
  party: string;
  za: number;
  protiv: number;
  vazdrzhal: number;
}

export interface LawChange {
  member: string; // "чл. 8"
  before?: string; // липсва при кратка справка
  after: string;
  plain: string; // обяснение на прост език
}

export interface AmendmentSources {
  dv?: string; // връзка към Държавен вестник (showMaterialDV.jsp?idMat=...)
  bill?: string; // връзка към законопроекта в parliament.bg
  news?: string[]; // медийни/официални новини за приемането
}

export interface Amendment {
  id: string;
  lawId: string;
  shortTitle: string; // "ЗИД на Изборния кодекс"
  fullTitle?: string; // пълното заглавие както е в ДВ (за H1)
  dv: string; // "ДВ, бр. 52/2025"
  dvLink?: string;
  dateAdopted: string; // ISO
  dateDV?: string; // ISO; липсва ако е неизвестен точният ден
  assemblyId: string;
  vnositel?: string; // липсва при кратка справка
  vnositelType?: "МС" | "депутати" | "президент";
  billSignatura?: string;
  /** Директна връзка към законопроекта (текст + мотиви) в parliament.bg */
  billUrl?: string;
  motives?: string; // кратък преразказ на мотивите; липсва при кратка справка
  motivesLink?: string;
  votes?: { za: number; protiv: number; vazdrzhal: number; otsastvat?: number };
  votesByParty?: PartyVote[];
  stenogramLink?: string;
  changes: LawChange[];
  /** При кратка справка: кои членове са пипнати (без пълен diff) */
  changedMembers?: string[];
  summary: string; // 1-2 изречения на прост език
  tags: string[];
  /** Ниво на детайл: full = всичко сверено; basic = кратка справка (предстои diff/мотиви/гласуване) */
  detailLevel: "full" | "basic";
  /** Проверени ли са фактите (дати, ДВ, съдържание) по първичен източник */
  verified: boolean;
  /** Проверено ли е гласуването: false = илюстративно, true = по протокол, "partial" = частично */
  votesVerified?: boolean | "partial";
  votesNote?: string;
  sources?: AmendmentSources;
  /** Дата на президентския указ за обнародване (ISO) */
  dateDecree?: string;
  /** Номер на указа (напр. "№ 310") */
  decreeNo?: string;
  /** Дата на влизане в сила (ISO) */
  dateEffective?: string;
  /** Президентско вето: кой го наложи + дата на преодоляване + връзка към мотивите */
  veto?: { by: string; overridden: string; motivesUrl?: string };
}

export interface Law {
  id: string;
  name: string;
  short: string;
  code: string; // "ИК"
  description: string;
  firstAdopted: string; // година
  category: string;
  amendments: string[]; // ids, подредени нови -> стари
}

/**
 * Групи решения/ратификации — не са закони и не се показват в /zakoni.
 * Тук (без данни), за да може клиентският /zakoni да го ползва без тежки imports.
 */
export const HIDDEN_LAW_IDS = new Set([
  "resheniya-drugi",
  "resheniya-pravila",
  "resheniya-finansi",
  "resheniya-strategii",
  "resheniya-komisii",
  "resheniya-izbori",
  "resheniya-organi",
  "ratifikatsii",
]);
