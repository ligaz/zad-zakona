/**
 * Седмична проверка за нови броеве на Държавен вестник.
 *
 * Употреба: npm run check:dv [-- --json]
 *   --json: машинен изход за chaining (нови броеве, липсващи issues,
 *   акти с ДВ без dv_mat) — за подаване към enumerate/resolve скриптовете.
 *
 * ДВ няма публично API — страницата е JSP (dv.parliament.bg/DVWeb).
 * Скриптът е умишлено прост и без зависимости:
 *  1. тегли списъка „Броеве“ (broeveList.faces — последните ~10 броеве; резервно
 *     index.faces само с последния — ВНИМАНИЕ: https://dv.parliament.bg/ е само
 *     meta-refresh към нея; инцидент 10.2026: бр. 96/2026 беше пропуснат между
 *     две проверки точно заради това);
 *  2. сравнява броевете с индекса и проверява ПЪЛНОТО покритие на последния брой
 *     (секция „Народно събрание“ в RSS vs актове в индекса — частично покритие,
 *     напр. ДВ 30/2026: 7 закона в ДВ, 1 в индекса, не се хваща от „липсващ брой“);
 *  3. изброява законите в data/laws.json и последното им изменение;
 *  4. принтира чеклист какво да провери човек ръчно.
 *
 * Човешката проверка е задължителна: всяко изменение влиза в data/
 * само след сверка на дата, НС, указ и текст на параграфите.
 */
import { readJsonArrayStream } from "./json-io.mjs";

const DV_HOME = "https://dv.parliament.bg/DVWeb/index.faces";
const DV_ISSUES = "https://dv.parliament.bg/DVWeb/broeveList.faces";
const DV_RSS = "https://dv.parliament.bg/DVWeb/rss_newspaper.jsp";
const JSON_MODE = process.argv.includes("--json");

/** Нормализира "бр. N/дата|година" до "година,брой" за сверка с индекса. */
function issueKey(s) {
  let m = s.match(/^(\d{1,3})\/(\d{1,2})\.(\d{1,2})\.(20\d\d)$/);
  if (m) return `${m[4]},${m[1]}`;
  m = s.match(/^(\d{1,3})\/(20\d\d)$/);
  if (m) return `${m[2]},${m[1]}`;
  return null;
}

/** Минимално decode на XML entities от RSS-а. */
function decodeXml(s) {
  return (s || "")
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&bdquo;/g, "„")
    .replace(/&ldquo;/g, "“")
    .replace(/&rdquo;/g, "”")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "zad-zakona-check/0.1 (civic-project)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function main() {
  if (!JSON_MODE) console.log("=== Зад Закона — седмична проверка на ДВ ===\n");

  // 1. Последни броеве — от списъка „Броеве" (broeveList.faces, последните ~10),
  //    за да не се пропуска брой, излязъл между две седмични проверки.
  //    Резервно: index.faces (само последния брой).
  let homeIssues = [];
  let issuesSource = null;
  {
    const seen = new Set();
    const addIssue = (num, date) => {
      const k = `${num}/${date}`;
      if (!seen.has(k)) { seen.add(k); homeIssues.push(k); }
    };
    for (const [url, re, src] of [
      // „Брой 97, 23.10.2026 г.“ (бр. 90 е „… (извънреден)“ — суфиксът не пречи)
      [DV_ISSUES, /брой\s+(\d{1,3}),\s*(\d{1,2}\.\d{1,2}\.20\d{2})/gi, "broeveList"],
      // „Брой: 97, от дата 23.10.2026 г.“ (index.faces)
      [DV_HOME, /брой:\s*(\d{1,3}),\s*от\s*дата\s*([\d.]+)/gi, "home"],
    ]) {
      if (homeIssues.length) break;
      try {
        const html = await fetchText(url);
        let m;
        while ((m = re.exec(html)) !== null) addIssue(m[1], m[2]);
        if (homeIssues.length) issuesSource = src;
      } catch (e) {
        if (src === "home") {
          if (JSON_MODE) {
            console.log(JSON.stringify({ error: `DV issues: ${e.message}` }));
            return;
          }
          console.log(`⚠ Не можах да изтегля броевете (broeveList.faces и index.faces): ${e.message}`);
          console.log("  Провери ръчно: https://dv.parliament.bg/DVWeb/broeveList.faces");
        }
      }
    }
    if (!JSON_MODE) {
      console.log(
        homeIssues.length > 0
          ? `Намерени броеве (${issuesSource}):\n  ${homeIssues.slice(0, 15).join(", ")}`
          : "Не са разпознати броеве — отвори https://dv.parliament.bg/DVWeb/broeveList.faces ръчно."
      );
    }
  }

  // 2. Какво имаме в data/
  const { readFileSync } = await import("node:fs");
  const laws = JSON.parse(readFileSync("data/laws.json", "utf8"));
  const amendments = JSON.parse(readFileSync("data/amendments.json", "utf8"));
  const byId = Object.fromEntries(amendments.map((a) => [a.id, a]));
  // Индексът се чете стриймнато — трябват ни само агрегати, не целият масив.
  const idxIssues = new Set();
  const idxCounts = new Map();
  let indexMaxId = 0;
  let indexSize = 0;
  let needDvMatTotal = 0;
  const needDvMatSample = [];
  for await (const x of readJsonArrayStream("data/acts-index.json")) {
    indexSize++;
    if (x.id > indexMaxId) indexMaxId = x.id;
    if (x.dv_iss && x.dv_year) {
      const k = `${x.dv_year},${x.dv_iss}`;
      idxIssues.add(k);
      idxCounts.set(k, (idxCounts.get(k) || 0) + 1);
    }
    if (x.dv_iss && !x.dv_mat) {
      needDvMatTotal++;
      if (needDvMatSample.length < 50) needDvMatSample.push(x.id);
    }
  }
  const missingIssues = homeIssues.map(issueKey).filter((k) => k && !idxIssues.has(k));

  // 2. Пълно покритие на последния брой: RSS дава чистите заглавия на материалите
  // от секция „Народно събрание“; сравняваме ги с актовете в индекса. Така се
  // хваща и ЧАСТИЧНО покритие (missingIssues гледа само цели липсващи броеве).
  let latestCoverage = null;
  try {
    const rss = await fetchText(DV_RSS);
    const items = [...rss.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((mm) => {
      const g = (re) => (mm[1].match(re)?.[1] ?? "").trim();
      return {
        title: decodeXml(g(/<description>([\s\S]*?)<\/description>/)),
        category: decodeXml(g(/<category>([\s\S]*?)<\/category>/)),
        pubDate: g(/<pubDate>([\s\S]*?)<\/pubDate>/).slice(0, 10),
      };
    });
    const ns = items.filter((i) => /събрание/i.test(i.category));
    const latestKey = homeIssues.length ? issueKey(homeIssues[0]) : null;
    const indexedCount = latestKey ? idxCounts.get(latestKey) || 0 : 0;
    latestCoverage = {
      issue: latestKey,
      dvNsCount: ns.length,
      indexCount: indexedCount,
      ok: !latestKey || ns.length === 0 || indexedCount >= ns.length,
      titles: ns.map((i) => i.title),
    };
  } catch (e) {
    latestCoverage = { error: e.message };
  }

  if (JSON_MODE) {
    const lawRows = laws.map((law) => {
      const last = byId[law.amendments[0]];
      return {
        name: law.name,
        lastDv: last?.dv ?? null,
        verified: law.amendments.filter((id) => byId[id]?.verified).length,
        total: law.amendments.length,
      };
    });
    console.log(
      JSON.stringify(
        {
          dvHome: homeIssues,
          issuesSource,
          missingIssues,
          latestCoverage,
          indexMaxId,
          indexSize,
          actsNeedingDvMat: { total: needDvMatTotal, sampleIds: needDvMatSample },
          laws: lawRows,
        },
        null,
        2
      )
    );
    return;
  }
  console.log("\nПокритие в data/ (последно изменение):");
  for (const law of laws) {
    const last = byId[law.amendments[0]];
    const v = law.amendments.filter((id) => byId[id]?.verified).length;
    console.log(
      `  - ${law.name}: ${last ? `${last.dv} (${last.dateAdopted})` : "няма"} · ✓ ${v}/${law.amendments.length}`
    );
  }
  if (missingIssues.length > 0) {
    console.log(`\nНови броеве извън индекса: ${missingIssues.join(" ")}`);
    console.log(`  → node scripts/resolve-dv-mat.mjs --only ${missingIssues.join(" ")}`);
  }
  if (latestCoverage && !latestCoverage.error && latestCoverage.issue) {
    console.log(
      `\nПоследен брой ${latestCoverage.issue.replace(",", "/")}: ${latestCoverage.dvNsCount} материала в секция „Народно събрание“, ${latestCoverage.indexCount} акта в индекса.`
    );
    if (!latestCoverage.ok) {
      console.log("⚠ Възможно НЕПЪЛНО покритие — провери ръчно:");
      for (const t of latestCoverage.titles) console.log(`   - ${t}`);
      console.log("  → липсващи връзки в източника се добавят с node scripts/backfill-dv-links.mjs (виж файла)");
    } else {
      console.log("✓ Покритието изглежда пълно.");
    }
  }
  if (latestCoverage?.error) console.log(`\n⚠ RSS на ДВ: ${latestCoverage.error}`);
  if (needDvMatTotal > 0) {
    console.log(`Актове с ДВ без dv_mat: ${needDvMatTotal} (напр. ${needDvMatSample.slice(0, 5).join(", ")})`);
  }

  console.log(`
Чеклист за човек (15–30 мин/седмица):
  1. Отвори https://dv.parliament.bg/ → виж новите броеве от последната проверка.
  2. За всеки закон „за изменение…“: отвори текста, запиши ДВ брой, дата,
     НС, указ, президент и параграфите (§) — дословни цитати за before/after.
  3. В parliament.bg → Законопроекти намери сигнатурата и мотивите;
     в Стенограми — поименното гласуване.
  4. Добави обект в data/amendments.json (verified: true, sources.dv, votesVerified)
     и id-то в data/laws.json. Напиши „с прости думи“ за всяка промяна.
  5. npm run build && git push → сайтът се обновява автоматично.
`);
}

main().catch((e) => {
  console.error("Грешка:", e.message);
  process.exit(1);
});
