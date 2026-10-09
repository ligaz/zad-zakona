/**
 * Merge на курираните актове (worker outputs) в amendments.json + laws.json.
 * Употреба: node scripts/merge-curated.mjs [--dry]
 */
import { readFileSync, writeFileSync } from "node:fs";

const DRY = process.argv.includes("--dry");
const amendments = JSON.parse(readFileSync("data/amendments.json", "utf8"));
const laws = JSON.parse(readFileSync("data/laws.json", "utf8"));
const idx = Object.fromEntries(
  JSON.parse(readFileSync("data/acts-index.json", "utf8")).map((x) => [x.id, x])
);
const merged = JSON.parse(readFileSync("/tmp/curate-merged.json", "utf8"));
const dates = JSON.parse(readFileSync("/tmp/act-dates.json", "utf8"));
const assemblies = JSON.parse(readFileSync("data/assemblies.json", "utf8"));

const TR = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sht", ъ: "a", ь: "", ю: "yu", я: "ya" };
const slugBase = (s) =>
  s.toLowerCase().split("").map((c) => TR[c] ?? (/[a-z0-9]/.test(c) ? c : "-")).join("")
    .replace(/-+/g, "-").replace(/^-|-$/g, "") || "zakon";
const usedSlugs = new Set();
const slug = (s) => {
  const base = slugBase(s);
  let c = base, i = 2;
  while (usedSlugs.has(c)) c = `${base}-${i++}`;
  usedSlugs.add(c);
  return c;
};

const CATS = [
  [/наказател|затвор|престъп/i, "Правосъдие"],
  [/здрав|лекар|болниц|медицин/i, "Здраве"],
  [/труд|работ|осигуряв|социалн|пенси/i, "Труд и социална политика"],
  [/движение|пътища|шофьор|автомобил|катастроф/i, "Транспорт"],
  [/избор|гласуване|парти/i, "Избори и власт"],
  [/чужден|миграц|убежище|виз/i, "Миграция"],
  [/данък|бюджет|финанси|осигуровки|банки|сметн/i, "Финанси"],
  [/образование|училищ|студент|наук/i, "Образование"],
  [/околна среда|отпадъц|еколог|води|гори|природ/i, "Околна среда"],
  [/енерг|електрич|топло|газ/i, "Енергетика"],
  [/отбран|арми|войник|полиц|сигурност|вътрешни работи/i, "Сигурност"],
  [/съд|съдебн|адвокат|нотариус/i, "Правосъдие"],
  [/земедел|храни|фермер/i, "Земеделие"],
  [/култур|кино|меди|спорт|туризъм/i, "Култура и спорт"],
  [/търгов|икономик|предприят|инвестиц/i, "Икономика"],
];
const catOf = (name) => {
  for (const [re, c] of CATS) if (re.test(name)) return c;
  return "Други";
};

// родителски закон от заглавието → именителен падеж, без години
function parentLaw(title) {
  let t = (title || "").trim();
  if (/ратифиц|денонсир/i.test(t)) return null; // ратификации — отделно
  let prev = "";
  while (prev !== t) {
    prev = t;
    t = t.replace(/^[Зз]акон за (изменение и допълнение|изменение|допълнение) на /i, "");
  }
  t = t.replace(/^[Зз]акона за /, "Закон за ")
    .replace(/^[Кк]одекса /, "Кодекс ")
    .replace(/ния кодекс$/i, "ен кодекс")
    .replace(/ия кодекс$/i, "ен кодекс")
    .replace(/\s*,?\s*(за|през) 20\d\d\s?г\.?/gi, "")
    .replace(/\s+/g, " ").trim();
  return t || null;
}

const ALIAS = {
  "наказателен кодекс": "nakazatelen-kodeks",
  "кодекс на труда": "kodeks-truda",
  "изборен кодекс": "izboren-kodeks",
  "закон за движението по пътищата": "zdvp",
  "закон за чужденците": "zakon-chuzhdentsi",
  "закон за здравното осигуряване": "zzo",
};

const byName = Object.fromEntries(laws.map((l) => [l.name.toLowerCase(), l]));
for (const l of laws) usedSlugs.add(l.id);
const usedCodes = new Set(laws.map((l) => l.code));
const codeOf = (name) => {
  const words = name.replace(/^Закон за |^Кодекс (на )?/, "").split(/\s+/).filter((w) => w.length > 2 && !/^(на|за|по|и|от|с|в)$/i.test(w));
  let code = words.map((w) => w[0].toUpperCase()).join("").slice(0, 5) || "З";
  let c = code, i = 2;
  while (usedCodes.has(c)) c = code + i++;
  usedCodes.add(c);
  return c;
};

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

let nNew = 0, nRat = 0;
const haveAmend = new Set(amendments.map((a) => a.id));
// ratifikatsii entry предварително (ползва се в цикъла)
if (!laws.find((l) => l.id === "ratifikatsii")) {
  laws.push({
    id: "ratifikatsii", name: "Международни договори (ратификации)",
    short: "Ратификации", code: "РАТ",
    description: "Договори и спогодби, ратифицирани от парламента — с кого и за какво.",
    firstAdopted: "2021", category: "Външна политика", amendments: [],
  });
}
for (const o of merged) {
  const x = idx[o.actId];
  if (!x) continue;
  const title = x.final || x.title || "";
  const isRat = /^закон за ратифиц/i.test(title) || /денонсир/i.test(title);
  const aid = `act-${o.actId}`;
  if (haveAmend.has(aid)) continue;
  let lawId;
  if (isRat) {
    lawId = "ratifikatsii";
    nRat++;
  } else {
    const pname = parentLaw(title);
    const aliasHit = (pname && ALIAS[pname.toLowerCase()]) || null;
    const hit = aliasHit
      ? laws.find((l) => l.id === aliasHit)
      : pname && byName[pname.toLowerCase()];
    if (hit) {
      lawId = hit.id;
    } else if (pname) {
      lawId = slug(pname);
      if (!byName[pname.toLowerCase()]) {
        const nl = {
          id: lawId, name: pname,
          short: pname.replace(/^Закон за /, "").slice(0, 40),
          code: codeOf(pname),
          description: `Всички изменения на ${pname} — какво се промени, кой гласува и кой управляваше.`,
          firstAdopted: (dates[String(o.actId)] || "2021").slice(0, 4),
          category: catOf(pname),
          amendments: [],
        };
        laws.push(nl);
        byName[pname.toLowerCase()] = nl;
      }
      lawId = byName[pname.toLowerCase()].id;
    } else {
      lawId = "ratifikatsii";
    }
  }
  const dv = `ДВ, бр. ${x.dv_iss}/${x.dv_year}`;
  const dateAdopted = dates[String(o.actId)] || null;
  const rec = {
    id: aid,
    lawId,
    shortTitle: o.shortTitle || title.slice(0, 80),
    dv,
    dateAdopted,
    assemblyId: asmFor(dateAdopted) || "52-ns",
    detailLevel: "full",
    verified: true,
    changes: o.changes || [],
    changedMembers: o.changedMembers || [],
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
  nNew++;
  const law = laws.find((l) => l.id === lawId);
  if (law && !law.amendments.includes(aid)) law.amendments.push(aid);
}

// sort law.amendments нови -> стари
const byDate = Object.fromEntries(amendments.map((a) => [a.id, a.dateAdopted || ""]));
for (const l of laws) {
  l.amendments.sort((a, b) => String(byDate[b] || "").localeCompare(String(byDate[a] || "")));
  if (l.amendments.length) {
    const years = l.amendments.map((id) => String(byDate[id] || "").slice(0, 4)).filter(Boolean).sort();
    if (years.length) l.firstAdopted = years[0];
  }
}

if (!DRY) {
  writeFileSync("data/amendments.json", JSON.stringify(amendments, null, 2) + "\n");
  writeFileSync("data/laws.json", JSON.stringify(laws, null, 2) + "\n");
}
console.log(`new amendments: ${nNew} (rat: ${nRat}) | laws: ${laws.length}`);
