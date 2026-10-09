/**
 * Merge на курираните РЕШЕНИЯ в amendments.json + тематични law entries.
 * Употреба: node scripts/merge-decisions.mjs [--dry]
 */
import { readFileSync, writeFileSync } from "node:fs";

const DRY = process.argv.includes("--dry");
const amendments = JSON.parse(readFileSync("data/amendments.json", "utf8"));
const laws = JSON.parse(readFileSync("data/laws.json", "utf8"));
const idx = Object.fromEntries(
  JSON.parse(readFileSync("data/acts-index.json", "utf8")).map((x) => [x.id, x])
);
const assemblies = JSON.parse(readFileSync("data/assemblies.json", "utf8"));
const dates = JSON.parse(readFileSync("/tmp/dec-dates.json", "utf8")); // actId -> ISO приемане

const curated = [];
for (let i = 0; i < 8; i++) {
  try {
    curated.push(...JSON.parse(readFileSync(`/tmp/curate-dec-out-${i}.json`, "utf8")));
  } catch { /* няма файл */ }
}

// тематични групи за решения
const GROUPS = [
  [/комиси|подкомиси/i, ["resheniya-komisii", "Парламентарни комисии", "Комисии", "КОМИСИИ", "Създаване, избиране и промени в състава на комисиите.", "Избори и власт"]],
  [/процедурни правила|председател|заместник|членове|управител|омбудсман|rapp?o|избиране на|освобождаване|назначаване|прекратяване.*мандат|оставка/i, ["resheniya-organi", "Избор на органи", "Органи", "ОРГАНИ", "Избори на шефове на институции — БНБ, НЗОК, Сметна палата, омбудсман и др.", "Избори и власт"]],
  [/стратеги|деклараци|обръщение|позиция|приоритет/i, ["resheniya-strategii", "Стратегии и декларации", "Стратегии", "СТРАТЕГИИ", "Стратегии, декларации и позиции на парламента.", "Избори и власт"]],
  [/правилник|поднс|вътрешни правила|парламентарен контрол|програма/i, ["resheniya-pravila", "Правила на парламента", "Правила", "ПРАВИЛА", "Правилник, програми и вътрешен ред на НС.", "Избори и власт"]],
  [/бюджет|финанси|разходи|средства|дава съгласие|заем|гаранци/i, ["resheniya-finansi", "Финансови решения", "Финанси", "ФИНАНСИ", "Бюджети, заеми, гаранции и разходи.", "Финанси"]],
  [/избор.*(предсроч|частич|насрочване)|референдум|гласуване/i, ["resheniya-izbori", "Избори и вотове", "Вотове", "ВОТОВЕ", "Насрочвания на избори, референдуми и вотове.", "Избори и власт"]],
];
const FALLBACK = ["resheniya-drugi", "Други решения", "Други", "ДРУГИ", "Всички останали решения на Народното събрание.", "Избори и власт"];

for (const [re, g] of GROUPS) {
  if (!laws.find((l) => l.id === g[0])) {
    laws.push({ id: g[0], name: g[1], short: g[2], code: g[3], description: g[4], firstAdopted: "2021", category: g[5], amendments: [] });
  }
}
if (!laws.find((l) => l.id === FALLBACK[0])) {
  laws.push({ id: FALLBACK[0], name: FALLBACK[1], short: FALLBACK[2], code: FALLBACK[3], description: FALLBACK[4], firstAdopted: "2021", category: FALLBACK[5], amendments: [] });
}

const asmFor = (ds) => {
  if (!ds) return null;
  for (const a of assemblies) {
    if (a.from && ds >= a.from && (!a.to || ds <= a.to)) return a.id;
  }
  return null;
};

// НС номер → plenary ID в parliament.bg URL-ите (като NS_API във fetch скриптовете).
const NS_PLEN = { 44: 52, 45: 55, 46: 56, 47: 57, 48: 58, 49: 59, 50: 60, 51: 61, 52: 62 };
// Поправя workerски линкове с нерезолвната НС: .../ns/undefined/ID/11165.
const fixStenLink = (link, assemblyId) => {
  if (!String(link || "").includes("/ns/undefined/")) return link;
  const api = NS_PLEN[Number(String(assemblyId || "").split("-")[0])];
  if (!api) {
    console.warn(`  ! stenogramLink без НС мапинг: ${link} (${assemblyId})`);
    return link;
  }
  return link.replace("/ns/undefined/", `/ns/${api}/`);
};

const groupOf = (title) => {
  for (const [re, g] of GROUPS) if (re.test(title || "")) return g[0];
  return FALLBACK[0];
};

const haveAmend = new Set(amendments.map((a) => a.id));
let n = 0;
for (const o of curated) {
  const x = idx[o.actId];
  if (!x) continue;
  const aid = `act-${o.actId}`;
  if (haveAmend.has(aid)) continue;
  const title = x.final || x.title || "";
  const lawId = groupOf(title);
  const dv = x.dv_iss && x.dv_year ? `ДВ, бр. ${x.dv_iss}/${x.dv_year}` : (o.dv ? `ДВ, бр. ${o.dv}` : "");
  const dd = dates[String(o.actId)];
  const dateAdopted = dd && dd !== "NONE" && dd !== "ERR" ? dd : null;
  const rec = {
    id: aid,
    lawId,
    shortTitle: o.shortTitle || title.slice(0, 80),
    dv,
    dateAdopted,
    assemblyId: asmFor(dateAdopted) || "52-ns",
    detailLevel: "full",
    verified: true,
    changes: [],
    changedMembers: [],
    summary: o.summary || "",
    tags: o.tags || [],
    sources: {
      ...(x.dv_mat ? { dv: `https://dv.parliament.bg/DVWeb/showMaterialDV.jsp?idMat=${x.dv_mat}` } : {}),
      bill: `https://www.parliament.bg/bg/laws/ID/${o.actId}`,
    },
    billUrl: `https://www.parliament.bg/bg/bills/ID/${o.actId}`,
    ...(o.billSignatura ? { billSignatura: o.billSignatura } : {}),
  };
  if (x.votes) {
    rec.votes = x.votes;
    if (x.votesByParty?.length) rec.votesByParty = x.votesByParty;
    rec.votesVerified = x.votesVerified ?? true;
  }
  if (x.stenogramLink) rec.stenogramLink = fixStenLink(x.stenogramLink, rec.assemblyId);
  if (x.vnositel) {
    rec.vnositel = x.vnositel;
    if (x.vnositelType) rec.vnositelType = x.vnositelType;
  }
  amendments.push(rec);
  n++;
  const law = laws.find((l) => l.id === lawId);
  if (law && !law.amendments.includes(aid)) law.amendments.push(aid);
}

const byDate = Object.fromEntries(amendments.map((a) => [a.id, a.dateAdopted || ""]));
for (const l of laws) {
  l.amendments.sort((a, b) => String(byDate[b] || "").localeCompare(String(byDate[a] || "")));
  const years = l.amendments.map((id) => String(byDate[id] || "").slice(0, 4)).filter(Boolean).sort();
  if (years.length) l.firstAdopted = years[0];
}

if (!DRY) {
  writeFileSync("data/amendments.json", JSON.stringify(amendments, null, 2) + "\n");
  writeFileSync("data/laws.json", JSON.stringify(laws, null, 2) + "\n");
}
console.log(`new decision amendments: ${n} | laws: ${laws.length} | total amendments: ${amendments.length}`);
