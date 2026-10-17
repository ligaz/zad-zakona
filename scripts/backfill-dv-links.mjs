/**
 * Backfill на ДВ връзки за актове, които parliament.bg API НЕ е вързало към
 * броя на ДВ (L_Act_dv_iss празно и L_Act_dv_ID = -1), но актът е обнародван.
 *
 * Инцидент 10.2026: ДВ, бр. 30 от 27.3.2026 — 7 закона в секция „Народно
 * събрание“, а API-то е попълнило връзката само за 1 (ЗСП, id 166883). Шестте
 * липсващи се добавят тук със СВЕРКА срещу страницата на материала в ДВ:
 *   - броят и датата на страницата трябва да съвпадат (брой: 30, от дата 27.3.2026);
 *   - указът (УКАЗ № N) трябва да присъства;
 *   - заглавието от указа трябва да се среща в текста.
 * Употреба: node scripts/backfill-dv-links.mjs [--dry]
 * Идемпотентно: записи със същите стойности се прескачат; различни → грешка.
 */
import { readJsonArrayStream, writeJsonArrayFile, serialSaver } from "./json-io.mjs";

const UA = "zad-zakona-backfill/0.1 (civic-project)";
const OUT = "data/acts-index.json";
const DRY = process.argv.includes("--dry");

// Сверени ръчно срещу ДВ (idMat → страница): акт → брой/материал/окончателно заглавие.
const MAP = [
  // ДВ, бр. 30/2026, обнародвани с укази № 125–131:
  { act: 166788, iss: "30", year: 2026, mat: 241982, decree: "125",
    final: "Закон за изменение и допълнение на Закона за защита от дискриминация" },
  { act: 166789, iss: "30", year: 2026, mat: 241981, decree: "126",
    final: "Закон за ратифициране на Рамковото споразумение между правителството на Република България и Федералния съвет на Конфедерация Швейцария относно изпълнението на Втория швейцарски принос към избрани държави – членки на Европейския съюз, за подкрепа на мерки в областта на миграцията" },
  { act: 166879, iss: "30", year: 2026, mat: 242046, decree: "127",
    final: "Закон за изменение и допълнение на Закона за корпоративното подоходно облагане" },
  { act: 166872, iss: "30", year: 2026, mat: 242170, decree: "129",
    final: "Закон за изменение и допълнение на Закона за събирането на приходи и извършването на разходи през 2026 г. до приемането на Закона за държавния бюджет на Република България за 2026 г., Закона за бюджета на държавното обществено осигуряване за 2026 г. и Закона за бюджета на Националната здравноосигурителна каса за 2026 г." },
  { act: 166823, iss: "30", year: 2026, mat: 242171, decree: "130",
    final: "Закон за изменение и допълнение на Закона за обществените библиотеки" },
  { act: 166873, iss: "30", year: 2026, mat: 242221, decree: "131",
    final: "Закон за прозрачност при представителство на интереси" },
];

const norm = (s) => (s || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;|&#xa0;/gi, " ")
  .replace(/&ndash;|&#8211;/g, "–").replace(/&mdash;/g, "—").replace(/&bdquo;|&#8222;/g, "„")
  .replace(/&ldquo;|&#8220;/g, "“").replace(/&rdquo;|&#8221;/g, "”").replace(/&quot;/g, '"')
  .replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

async function verifyMaterial({ iss, mat, decree, final }) {
  const r = await fetch(`https://dv.parliament.bg/DVWeb/showMaterialDV.jsp?idMat=${mat}`, {
    headers: { "User-Agent": UA },
  });
  if (!r.ok) return `HTTP ${r.status}`;
  const t = norm(await r.text());
  if (!new RegExp(`брой:\\s*${iss},\\s*от\\s*дата`, "i").test(t)) return "броят не съвпада";
  if (!t.toUpperCase().includes(`УКАЗ № ${decree}`)) return `липсва указ № ${decree}`;
  const definite = final.replace(/^Закон /, "Законът ");
  const low = t.toLowerCase();
  if (!low.includes(final.toLowerCase()) && !low.includes(definite.toLowerCase())) return "заглавието не се среща";
  return null; // ok
}

async function main() {
  const map = new Map(MAP.map((m) => [m.act, m]));
  // 1) сверка срещу ДВ (преди да пишем каквото и да е)
  for (const m of MAP) {
    const err = await verifyMaterial(m);
    console.log(`${err ? "✗" : "✓"} ${m.act} ← idMat ${m.mat}${err ? ` — ${err}` : ""}`);
    if (err) process.exitCode = 1;
  }
  if (process.exitCode) {
    console.log("Спирам: има несвързани материали — поправи MAP и пусни пак.");
    return;
  }
  // 2) прилагане върху индекса (keep на всички останали полета)
  const items = [];
  for await (const x of readJsonArrayStream(OUT)) items.push(x);
  let changed = 0;
  for (const x of items) {
    const m = map.get(x.id);
    if (!m) continue;
    const patch = { dv_iss: m.iss, dv_year: m.year, dv_mat: m.mat, final: m.final };
    for (const [k, v] of Object.entries(patch)) {
      if (x[k] === v) continue;
      if (k !== "dv_mat" && k !== "final" && x[k]) {
        console.error(`✗ ${x.id}: ${k} вече е „${x[k]}“, очаквах „${v}“ — не пипам.`);
        process.exitCode = 1;
      }
      x[k] = v;
    }
    changed++;
    console.log(`+ ${x.id}: ДВ ${m.iss}/${m.year}, idMat ${m.mat} — ${m.final.slice(0, 70)}…`);
  }
  if (process.exitCode) {
    console.log("Спирам: конфликт в индекса — нищо не е записано.");
    return;
  }
  if (DRY) {
    console.log(`dry: ${changed} записа щяха да се обновят`);
    return;
  }
  await serialSaver(() => writeJsonArrayFile(OUT, items, 1))();
  console.log(`Готово: ${changed} записа обновени (ДВ, бр. 30/2026).`);
}

main();
