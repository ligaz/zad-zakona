/**
 * Разплита клъстери: няколко акта с един и същи (стенограма, числа).
 * Тегли ПЪЛНИТЕ теми на гласуванията и ги мачва по име на комисия/орган.
 * Употреба: node scripts/resolve-clusters.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";

const UA = "zad-zakona-details/0.1";
const API = "https://www.parliament.bg/api/v1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function jget(url, tries = 0) {
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r;
  } catch (e) {
    if (tries >= 3) throw e;
    await sleep(3000 * (tries + 1));
    return jget(url, tries + 1);
  }
}

const parseRow = (r) => {
  const nums = r.slice(10).filter((x) => /^\d+$/.test(x)).map(Number);
  if (nums.length >= 5) return { party: r[9], za: nums[1], protiv: nums[2], vazdrzhal: nums[3] };
  return { party: r[9], za: nums[0] || 0, protiv: nums[1] || 0, vazdrzhal: nums[2] || 0 };
};

function unzip(buf, name) {
  let off = 0;
  while (off < buf.length - 30) {
    if (buf.readUInt32LE(off) !== 0x04034b50) { off++; continue; }
    const method = buf.readUInt16LE(off + 8);
    const csize = buf.readUInt32LE(off + 18);
    const nlen = buf.readUInt16LE(off + 26);
    const elen = buf.readUInt16LE(off + 28);
    const nm = buf.toString("utf8", off + 30, off + 30 + nlen);
    const data = buf.subarray(off + 30 + nlen + elen, off + 30 + nlen + elen + csize);
    if (nm === name) {
      if (method === 0) return data;
      if (method === 8) return inflateRawSync(data);
      throw new Error("zipm");
    }
    off += 30 + nlen + elen + csize;
  }
  throw new Error("nf");
}

function sheetRows(xml) {
  const rows = [];
  for (const m of xml.matchAll(/<row[^>]*>(.*?)<\/row>/gs)) {
    const cells = {};
    for (const c of m[1].matchAll(/<c[^>]*r="([A-Z]+)\d+"[^>]*>(.*?)<\/c>/gs)) {
      const t = [...c[2].matchAll(/<t[^>]*>(.*?)<\/t>/gs)].map((x) => x[1]).join("");
      const v = c[2].match(/<v>(.*?)<\/v>/);
      cells[c[1]] = t || (v ? v[1] : "");
    }
    rows.push(cells);
  }
  return rows;
}

// всички теми с ПЪЛЕН текст + вотове от стенограма
async function fullTopics(sid) {
  const sten = await (await jget(`${API}/pl-sten/${sid}`)).json();
  await sleep(400);
  const byTopic = new Map();
  const add = (topic, party, za, pr, vz) => {
    if (!byTopic.has(topic)) byTopic.set(topic, []);
    const arr = byTopic.get(topic);
    if (!arr.some((p) => p.party === party)) arr.push({ party, za, protiv: pr, vazdrzhal: vz });
  };
  for (const f of (sten.files || []).filter((x) => x.Pl_StenDfile?.endsWith(".csv"))) {
    const text = await (await jget("https://www.parliament.bg" + f.Pl_StenDfile)).text();
    await sleep(400);
    for (const line of text.split(/\r?\n/).slice(1)) {
      const r = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((x) => x.replace(/^"|"$/g, ""));
      if (!r[0]) continue;
      const p = parseRow(r);
      add(r[0], p.party, p.za, p.protiv, p.vazdrzhal);
    }
  }
  for (const f of (sten.files || []).filter((x) => x.Pl_StenDfile?.endsWith(".xlsx"))) {
    const buf = Buffer.from(await (await jget("https://www.parliament.bg" + f.Pl_StenDfile)).arrayBuffer());
    await sleep(400);
    let rows;
    try { rows = sheetRows(unzip(buf, "xl/worksheets/sheet1.xml").toString("utf-8")); }
    catch { continue; }
    for (let i = 0; i < rows.length; i++) {
      const a = rows[i].A || "";
      if (!a.includes("ГЛАСУВАНЕ")) continue;
      for (let j = i + 1; j < Math.min(i + 16, rows.length); j++) {
        const r = rows[j];
        if ((r.A || "").includes("ГЛАСУВАНЕ") || (r.A || "").includes("РЕГИСТРАЦИЯ")) break;
        if (!r.A || r.A === "ПГ" || r.A === "Общо:") continue;
        if (/^\d+$/.test(r.C || "") || /^\d+$/.test(r.D || "")) {
          add(a, r.A, Number(r.C) || 0, Number(r.D) || 0, Number(r.E) || 0);
        }
      }
    }
  }
  return [...byTopic.entries()].map(([topic, parties]) => ({
    topic,
    za: parties.reduce((s, p) => s + p.za, 0),
    protiv: parties.reduce((s, p) => s + p.protiv, 0),
    vazdrzhal: parties.reduce((s, p) => s + p.vazdrzhal, 0),
    parties,
  }));
}

// отличителни думи (дълги, не-стоп) от заглавие
const STOP = new Set(["решение", "решения", "закон", "закона", "изменение", "допълнение", "приемане", "избиране", "създаване", "утвърждаване", "народното", "събрание", "република", "българия", "условията", "реда", "предлагане", "кандидати", "кандидат", "членове", "председател"]);
function sigWords(s) {
  return (s || "").toLowerCase().split(/[^а-яa-z0-9]+/i).filter((w) => w.length > 5 && !STOP.has(w));
}

async function main() {
  const tot = JSON.parse(readFileSync("/tmp/dec-all.json", "utf8"));
  const idx = Object.fromEntries(JSON.parse(readFileSync("data/acts-index.json", "utf8")).map((x) => [x.id, x]));
  const key = {};
  for (const [aid, v] of Object.entries(tot)) {
    const p = v.pick;
    if (p && v.verified === true && !p.totalsOnly && p.parties?.length) {
      const k = `${p.stenId}|${p.votes.za}|${p.votes.protiv}|${p.votes.vazdrzhal}`;
      (key[k] ||= []).push(aid);
    }
  }
  const clusters = Object.entries(key).filter(([, v]) => v.length > 1);
  console.log("clusters:", clusters.length);
  const fixes = {};
  for (const [k, aids] of clusters) {
    const [stenId, za, pr, vz] = k.split("|").map(Number);
    const topics = await fullTopics(stenId);
    const cands = topics.filter((t) => t.za === za && t.protiv === pr && t.vazdrzhal === vz);
    if (!cands.length) {
      console.log(`cluster ${k} ${aids.join(",")}: NO full-topic match (hybrid?) -> quarantine all`);
      for (const aid of aids) fixes[aid] = { drop: true, reason: "cluster-no-topic" };
      continue;
    }
    for (const aid of aids) {
      const title = (idx[aid]?.final || idx[aid]?.title || "").toLowerCase();
      const sw = sigWords(title);
      let best = null, bestScore = -1;
      for (const c of cands) {
        const tl = c.topic.toLowerCase();
        const score = sw.filter((w) => tl.includes(w)).length;
        if (score > bestScore) { bestScore = score; best = c; }
      }
      if (bestScore <= 0) {
        fixes[aid] = { drop: true, reason: "cluster-no-name-match" };
      } else {
        // проверка: друг акт със същата най-добра тема?
        fixes[aid] = { topic: best.topic, parties: best.parties, score: bestScore };
      }
    }
    console.log(`cluster ${k}: ${aids.length} acts, ${cands.length} matching topics`);
    await sleep(500);
  }
  writeFileSync("/tmp/cluster-fixes.json", JSON.stringify(fixes));
  console.log("fixes:", Object.keys(fixes).length);
}
main();
