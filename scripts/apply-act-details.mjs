/**
 * Прилага сверените детайли от fetch-act-details.mjs върху acts-index.json.
 *
 * Входни файлове:
 *   /tmp/weekly-new-acts.json — изход на `fetch-act-details.mjs` (pick/status/vnositel)
 *   /tmp/act-picks-override.json — ръчно сверени picks (когато скриптът не е намерил
 *     кандидат или е в карантина заради проверката за ключова дума; виж бележките там)
 *   /tmp/act-cards.json — картички за /aktove: { "<actId>": { cardShort, cardTitle, cardSummary } }
 *
 * Пише (само за актовете във входа, идемпотентно):
 *   votes, votesVerified, votesByParty (нормализирани партии; нулевите редове отпадат),
 *   stenogramLink (ns по НС от датата на вота), vnositel/vnositelType,
 *   detailId (= act-<id>), cardShort/cardTitle/cardSummary.
 *
 * Употреба: node scripts/apply-act-details.mjs [--dry]
 */
import { readFileSync } from "node:fs";
import { readJsonArrayStream, writeJsonArrayFile } from "./json-io.mjs";

const OUT = "data/acts-index.json";
const DRY = process.argv.includes("--dry");

// Партийни имена от CSV/XLSX → както се показват в сайта (вж. docs/data-pipeline.md).
const NORM = {
  "ГЕРБ - СДС": "ГЕРБ-СДС", "ПП - ДБ": "ПП-ДБ", "ДПС - НН": "ДПС", "ДПС - ДПС": "ДПС",
  "БСП - ОЛ": "БСП", "ВЪЗРАЖДАНЕ": "Възраждане", "ВЕЛИЧИЕ": "Величие",
  "НЕЧЛ В ПГ": "независими", "НЕЧЛ ПГ": "независими", "НЕЗ": "независими",
};
const normParties = (list) => {
  const m = new Map();
  for (const e of list || []) {
    const p = NORM[(e.party || "").trim()] ?? (e.party || "").trim();
    if (!p) continue;
    const cur = m.get(p) ?? { party: p, za: 0, protiv: 0, vazdrzhal: 0 };
    cur.za += e.za || 0;
    cur.protiv += e.protiv || 0;
    cur.vazdrzhal += e.vazdrzhal || 0;
    m.set(p, cur);
  }
  return [...m.values()].filter((e) => e.za || e.protiv || e.vazdrzhal);
};

// НС номер → plenary ID в parliament.bg (като NS_PLEN във fetch-скриптовете).
const NS_PLEN = { 44: 52, 45: 55, 46: 56, 47: 57, 48: 58, 49: 59, 50: 60, 51: 61, 52: 62 };
const assemblies = JSON.parse(readFileSync("data/assemblies.json", "utf8"));
const plenIdFor = (iso) => {
  const a = assemblies.find((x) => x.from && iso >= x.from && (!x.to || iso <= x.to));
  return a ? NS_PLEN[a.number] : null;
};

// Име „Име Презиме Фамилия“ → „Име Фамилия“; първите 3 + „и още N“.
const shortName = (full) => {
  const w = String(full).trim().split(/\s+/);
  return w.length > 1 ? `${w[0]} ${w[w.length - 1]}` : w[0];
};
const vnositelOf = (v) => {
  if (v === "MC") return ["Министерски съвет", "МС"];
  if (v === "union") return ["Обединен законопроект", undefined]; // без vnositelType (прецедент в индекса)
  if (Array.isArray(v) && v.length) {
    const names = v.map(shortName);
    const head = names.slice(0, 3).join(", ");
    return [names.length > 3 ? `${head} и още ${names.length - 3}` : head, "депутати"];
  }
  return [null, null];
};

const weekly = JSON.parse(readFileSync("/tmp/weekly-new-acts.json", "utf8"));
const override = JSON.parse(readFileSync("/tmp/act-picks-override.json", "utf8"));
const cards = JSON.parse(readFileSync("/tmp/act-cards.json", "utf8"));

// Сглобява patch за всеки акт от входа: override печели пред pick (сверено ръчно).
const patches = new Map();
for (const [id, v] of Object.entries(weekly)) {
  const ov = override[id] || {};
  const p = v.pick || {};
  const votes = ov.votes || p.votes;
  const parties = ov.votesByParty || p.parties;
  const stenId = ov.stenId || p.stenId;
  const stenDate = p.stenDate || v.adoptGuess;
  if (!votes || !stenId) {
    console.error(`✗ ${id}: липсва вот (нито pick, нито override) — не пипам.`);
    process.exitCode = 1;
    continue;
  }
  const plen = plenIdFor(stenDate);
  if (!plen) {
    console.error(`✗ ${id}: няма НС за дата ${stenDate} — не пипам.`);
    process.exitCode = 1;
    continue;
  }
  const [vnositel, vnositelType] = vnositelOf(ov.vnositel ?? v.vnositel ?? "MC");
  if (!vnositel) {
    console.error(`✗ ${id}: неразпознат вносител ${JSON.stringify(v.vnositel)} — не пипам.`);
    process.exitCode = 1;
    continue;
  }
  const c = cards[id];
  if (!c?.cardShort || !c?.cardTitle || !c?.cardSummary) {
    console.error(`✗ ${id}: липсва картичка в act-cards.json — не пипам.`);
    process.exitCode = 1;
    continue;
  }
  // Пишем вот само ако е сверен (fetch скриптът verified:true или ръчен override).
  const verified = ov.votesVerified === true || v.verified === true;
  if (!verified) {
    console.error(`✗ ${id}: вотът не е сверен (verified ≠ true) — не пипам.`);
    process.exitCode = 1;
    continue;
  }
  patches.set(Number(id), {
    votes,
    votesVerified: true,
    votesByParty: normParties(parties),
    stenogramLink: `https://www.parliament.bg/bg/plenaryst/ns/${plen}/ID/${stenId}`,
    vnositel,
    ...(vnositelType ? { vnositelType } : {}),
    detailId: `act-${id}`,
    cardShort: c.cardShort,
    cardTitle: c.cardTitle,
    cardSummary: c.cardSummary,
  });
}
if (process.exitCode) {
  console.log("Спирам: входът е непълен — нищо не е записано.");
} else {
  const items = [];
  for await (const x of readJsonArrayStream(OUT)) items.push(x);
  let changed = 0;
  const seen = new Set();
  for (const x of items) {
    const patch = patches.get(x.id);
    if (!patch) continue;
    seen.add(x.id);
    let dirty = false;
    for (const [k, v] of Object.entries(patch)) {
      if (JSON.stringify(x[k]) === JSON.stringify(v)) continue;
      if (x[k] !== undefined && x[k] !== null) {
        console.error(`✗ ${x.id}: ${k} вече е ${JSON.stringify(x[k])}, очаквах ${JSON.stringify(v)} — не пипам.`);
        process.exitCode = 1;
        continue;
      }
      x[k] = v;
      dirty = true;
    }
    if (dirty) {
      changed++;
      console.log(`+ ${x.id}: ${patch.votes.za}/${patch.votes.protiv}/${patch.votes.vazdrzhal}, вносител „${patch.vnositel}“, детайл ${patch.detailId}`);
    }
  }
  for (const id of patches.keys()) {
    if (!seen.has(id)) {
      console.error(`✗ ${id}: не е намерен в ${OUT}.`);
      process.exitCode = 1;
    }
  }
  if (process.exitCode) {
    console.log("Спирам: конфликт/липсващ акт — нищо не е записано.");
  } else if (DRY) {
    console.log(`dry: ${changed} записа щяха да се обновят`);
  } else {
    await writeJsonArrayFile(OUT, items, 1);
    console.log(`Готово: ${changed} записа обновени.`);
  }
}
