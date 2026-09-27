/**
 * Разрешава истинските ДВ idMat за актовете: търсене по брой+година в ДВ,
 * после мачване акт→материал по заглавие.
 * Употреба: node scripts/resolve-dv-mat.mjs [--only year,iss,...] [--out file]
 * Изход: /tmp/dv-materials.json (issue -> [{idMat, section, title}])
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const UA = "Mozilla/5.0 (zad-zakona-resolve/0.1)";
const BASE = "https://dv.parliament.bg/DVWeb/searchDV.faces";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DEFAULT_OUT = "/tmp/dv-materials.json";

function parseMats(html) {
  const out = [];
  for (const m of html.matchAll(/<strong>(.*?)<\/strong>(.*?)showMaterialDV\.jsp[^"]*idMat=(\d+)/gs)) {
    const sec = m[1].replace(/<[^>]+>/g, "").trim();
    let body = m[2].replace(/<[^>]+>/g, " ").replace(/&#?\w+;/g, " ").replace(/\s+/g, " ").trim();
    body = body.replace(/\s*стр\.\s*\d+\s*$/i, "").trim();
    out.push({ idMat: Number(m[3]), section: sec, title: body.slice(0, 220) });
  }
  return out;
}

function pageCount(html) {
  const m = html.match(/<select[^>]*selectPage[^>]*>(.*?)<\/select>/s);
  if (!m) return 1;
  const opts = [...m[1].matchAll(/value="(\d+)"/g)].map((x) => Number(x[1]));
  return Math.max(...opts, 1);
}

const VSPAT = /name="javax.faces.ViewState"[^>]*value="([^"]+)"/;

async function searchIssue(iss, year) {
  const jar = [];
  const call = async (extra, vs) => {
    const params = new URLSearchParams({
      active_tab: "3", "search_form:not_first": "1",
      "search_form:_idJsp63": "", "search_form:_idJsp69": String(iss),
      "search_form:_idJsp71": "", "search_form:_idJsp75": "",
      "search_form:_idJsp79": "", "search_form:_idJsp81": "", "search_form:_idJsp83": "",
      "search_form:from_date": `01.01.${year}`, "search_form:to_date": `31.12.${year}`,
      "search_form:period_": "", "search_form_SUBMIT": "1",
      "javax.faces.ViewState": vs, ...extra,
    });
    const r = await fetch(BASE, {
      method: "POST",
      headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded", Cookie: jar.join("; ") },
      body: params.toString(),
    });
    for (const c of (r.headers.getSetCookie?.() ?? [])) jar.push(c.split(";")[0]);
    return await r.text();
  };
  const g = await fetch(BASE, { headers: { "User-Agent": UA } });
  for (const c of (g.headers.getSetCookie?.() ?? [])) jar.push(c.split(";")[0]);
  const vs = (await g.text()).match(VSPAT)?.[1];
  if (!vs) throw new Error("no viewstate");
  let html = await call({ "search_form:btnFind.x": "1", "search_form:btnFind.y": "1" }, vs);
  const all = parseMats(html);
  for (let p = 2, n = pageCount(html); p <= n; p++) {
    html = await call(
      { "search_form:_idcl": "search_form:chP", "search_form:selectPage": String(p) },
      html.match(VSPAT)?.[1] ?? vs
    );
    await sleep(700);
    all.push(...parseMats(html));
  }
  return all;
}

async function main() {
  const idx = JSON.parse(readFileSync("data/acts-index.json", "utf8"));
  const issues = [...new Set(
    idx.filter((x) => x.dv_iss && x.dv_year && x.dv_year >= 2021)
      .map((x) => `${x.dv_year},${x.dv_iss}`)
  )].sort();
  const only = process.argv.includes("--only")
    ? new Set(process.argv.slice(process.argv.indexOf("--only") + 1).filter((x) => !x.startsWith("--") && x.includes(",")))
    : null;
  const OUT = process.argv.includes("--out")
    ? process.argv[process.argv.indexOf("--out") + 1]
    : DEFAULT_OUT;
  const done = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
  // при --out worker-ите четат и общия напредък, за да прескачат готовите
  // (но не и при --only тестове)
  if (!only && OUT !== DEFAULT_OUT && existsSync(DEFAULT_OUT)) {
    Object.assign(done, JSON.parse(readFileSync(DEFAULT_OUT, "utf8")));
  }
  console.log(`issues: ${issues.length}, done: ${Object.keys(done).length}`);
  for (const key of issues) {
    if (only && !only.has(key)) continue;
    if (done[key]) continue;
    try {
      const [year, iss] = key.split(",");
      const mats = await searchIssue(iss, year);
      done[key] = mats;
      console.log(`ok ${key}: ${mats.length} материала`);
    } catch (e) {
      console.log(`ERR ${key}: ${e.message}`);
    }
    writeFileSync(OUT, JSON.stringify(done));
    await sleep(1500);
  }
  console.log("saved", Object.keys(done).length);
}
main();
