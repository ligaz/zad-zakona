/**
 * Прилага СВЕРЕНИ вотове (от /tmp/verified-votes.json) върху acts-index.json,
 * като пипа САМО 4-те полета: votes, votesVerified, votesByParty, stenogramLink.
 * Позволява презапис (за разлика от apply-act-details.mjs, който отказва
 * при съществуваща стойност) — целта е одитно поправяне на грешни вотове.
 *
 * Вход: /tmp/verified-votes.json — обект { "<actId>": {
 *   votes: { za, protiv, vazdrzhal },
 *   votesByParty: [{ party, za, protiv, vazdrzhal }],
 *   stenId: <Pl_Sten_id>,
 *   stenDate: "YYYY-MM-DD" (дата на заседанието),
 *   evidence?: "обявление в стенограмата" (за следа)
 * } }
 *
 * Употреба: node scripts/apply-verified-votes.mjs [--dry]
 */
import { readFileSync } from "node:fs";
import { readJsonArrayStream, writeJsonArrayFile } from "./json-io.mjs";

const OUT = "data/acts-index.json";
const inputArg = process.argv.find((a) => a.startsWith("--input="));
const INPUT = inputArg ? inputArg.slice("--input=".length) : "/tmp/verified-votes.json";
const DRY = process.argv.includes("--dry");

const NORM = {
  "ГЕРБ - СДС": "ГЕРБ-СДС", "ПП - ДБ": "ПП-ДБ", "ДПС - НН": "ДПС", "ДПС - ДПС": "ДПС",
  "БСП - ОЛ": "БСП", "ВЪЗРАЖДАНЕ": "Възраждане", "ВЕЛИЧИЕ": "Величие",
  "НЕЧЛ В ПГ": "независими", "НЕЧЛ ПГ": "независими", "НЕЗ": "независими",
  "БВ": "БВ", "АПС": "АПС", "МЕЧ": "МЕЧ",
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

const NS_PLEN = { 44: 52, 45: 55, 46: 56, 47: 57, 48: 58, 49: 59, 50: 60, 51: 61, 52: 62 };
const assemblies = JSON.parse(readFileSync("data/assemblies.json", "utf8"));
const plenIdFor = (iso) => {
  const a = assemblies.find((x) => x.from && iso >= x.from && (!x.to || iso <= x.to));
  return a ? NS_PLEN[a.number] : null;
};

const input = JSON.parse(readFileSync(INPUT, "utf8"));
const patches = new Map();
let bad = 0;
for (const [id, v] of Object.entries(input)) {
  const votes = v?.votes;
  if (!votes || votes.za === undefined || votes.protiv === undefined || votes.vazdrzhal === undefined) {
    console.error(`x ${id}: липсва валиден votes — пропускам.`);
    bad++; continue;
  }
  if (!v.stenId) { console.error(`x ${id}: липсва stenId — пропускам.`); bad++; continue; }
  if (!v.stenDate) { console.error(`x ${id}: липсва stenDate — пропускам.`); bad++; continue; }
  const plen = plenIdFor(v.stenDate);
  if (!plen) { console.error(`x ${id}: няма НС за дата ${v.stenDate} — пропускам.`); bad++; continue; }
  const patch = {
    votes: { za: votes.za, protiv: votes.protiv, vazdrzhal: votes.vazdrzhal },
    votesVerified: true,
    votesByParty: normParties(v.votesByParty),
    stenogramLink: `https://www.parliament.bg/bg/plenaryst/ns/${plen}/ID/${v.stenId}`,
  };
  if (v.vnositel) {
    patch.vnositel = v.vnositel;
    if (v.vnositelType) patch.vnositelType = v.vnositelType;
  }
  patches.set(Number(id), patch);
}
if (bad) { console.log(`Спирам: ${bad} записа с грешки във входа — нищо не е записано.`); process.exit(1); }

const items = [];
for await (const x of readJsonArrayStream(OUT)) items.push(x);

let changed = 0, unchanged = 0, missing = 0;
for (const x of items) {
  const patch = patches.get(x.id);
  if (!patch) continue;
  const oldVotes = x.votes ? `${x.votes.za}/${x.votes.protiv}/${x.votes.vazdrzhal}` : "-";
  const newVotes = `${patch.votes.za}/${patch.votes.protiv}/${patch.votes.vazdrzhal}`;
  const oldLink = x.stenogramLink || "-";
  const oldBp = x.votesByParty ? x.votesByParty.length : 0;
  const newBp = patch.votesByParty.length;
  const dirty = oldVotes !== newVotes || oldLink !== patch.stenogramLink
    || JSON.stringify(x.votesByParty) !== JSON.stringify(patch.votesByParty)
    || x.votesVerified !== true
    || (patch.vnositel && x.vnositel !== patch.vnositel);
  if (dirty) {
    changed++;
    console.log(`~ ${x.id}: votes ${oldVotes} -> ${newVotes}; link ${oldLink} -> ${patch.stenogramLink}; parties ${oldBp} -> ${newBp}`);
  } else {
    unchanged++;
  }
  if (dirty) {
    x.votes = patch.votes;
    x.votesVerified = true;
    x.votesByParty = patch.votesByParty;
    x.stenogramLink = patch.stenogramLink;
    if (patch.vnositel) {
      x.vnositel = patch.vnositel;
      if (patch.vnositelType) x.vnositelType = patch.vnositelType;
      else delete x.vnositelType;
    }
  }
}
for (const id of patches.keys()) {
  if (!items.some((x) => x.id === id)) { console.error(`x ${id}: не е намерен в ${OUT}.`); missing++; }
}
if (missing) { console.log("Спирам: липсващи актове — нищо не е записано."); process.exit(1); }

console.log(`\nРезюме: ${patches.size} записа във входа; ${changed} ще се променят; ${unchanged} без промяна.`);
if (DRY) {
  console.log("dry: нищо не е записано.");
} else {
  await writeJsonArrayFile(OUT, items, 1);
  console.log(`Готово: ${changed} записа обновени.`);
}