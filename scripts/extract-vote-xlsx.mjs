/**
 * Гласувания от XLSX файловете на стенограма (gv*.xlsx; CSV ги няма за 30.07.2025 и 2021).
 * Употреба: node scripts/extract-vote-xlsx.mjs <stenId> <keyword...>  (stdout JSON)
 */
import { inflateRawSync } from "node:zlib";

const UA = "zad-zakona-votes/0.1";
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

// минимален unzip: търсим sheet XML в zip (store/deflate)
function unzip(buf, name) {
  let off = 0;
  while (off < buf.length - 30) {
    if (buf.readUInt32LE(off) !== 0x04034b50) { off++; continue; }
    const method = buf.readUInt16LE(off + 8);
    const csize = buf.readUInt32LE(off + 18);
    const usize = buf.readUInt32LE(off + 22);
    const nlen = buf.readUInt16LE(off + 26);
    const elen = buf.readUInt16LE(off + 28);
    const nm = buf.toString("utf8", off + 30, off + 30 + nlen);
    const data = buf.subarray(off + 30 + nlen + elen, off + 30 + nlen + elen + csize);
    if (nm === name) {
      if (method === 0) return data;
      if (method === 8) return inflateRawSync(data);
      throw new Error("zip method " + method);
    }
    off += 30 + nlen + elen + csize;
  }
  throw new Error("not found: " + name);
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

async function main() {
  const [stenId, ...kws] = process.argv.slice(2);
  const kwsL = kws.map((k) => k.toLowerCase());
  const sten = await (await jget(`https://www.parliament.bg/api/v1/pl-sten/${stenId}`)).json();
  await sleep(400);
  const xlsxs = (sten.files || []).filter((f) => f.Pl_StenDfile && f.Pl_StenDfile.endsWith(".xlsx"));
  const mine = [];
  for (const x of xlsxs) {
    const buf = Buffer.from(await (await jget("https://www.parliament.bg" + x.Pl_StenDfile)).arrayBuffer());
    await sleep(400);
    let rows;
    try {
      rows = sheetRows(unzip(buf, "xl/worksheets/sheet1.xml").toString("utf-8"));
    } catch {
      continue;
    }
    for (let i = 0; i < rows.length; i++) {
      const a = rows[i].A || "";
      if (!a.includes("ГЛАСУВАНЕ") || !kwsL.every((k) => a.toLowerCase().includes(k))) continue;
      // блок: тема, header, Общо, партии (до следваща тема/регистрация)
      const parties = [];
      for (let j = i + 1; j < Math.min(i + 16, rows.length); j++) {
        const r = rows[j];
        if ((r.A || "").includes("ГЛАСУВАНЕ") || (r.A || "").includes("РЕГИСТРАЦИЯ")) break;
        if (!r.A || r.A === "ПГ" || r.A === "Общо:" || r.A.startsWith("Изборите") || r.A.startsWith("Народно")) continue;
        if (/^\d+$/.test(r.C || "") || /^\d+$/.test(r.D || "")) {
          parties.push({
            party: r.A,
            za: Number(r.C) || 0,
            protiv: Number(r.D) || 0,
            vazdrzhal: Number(r.E) || 0,
          });
        }
      }
      if (parties.length) mine.push({ topic: a, parties });
    }
  }
  const cands = mine.map((m) => ({
    t: m.topic.slice(0, 130),
    za: m.parties.reduce((s, p) => s + p.za, 0),
    no: m.parties.reduce((s, p) => s + p.protiv + p.vazdrzhal, 0),
  }));
  console.error("CANDIDATES: " + JSON.stringify(cands.map((c) => `${c.za}/${c.no} ${c.t.slice(0, 80)}`)));
  let pick = null;
  for (const m of mine) {
    const za = m.parties.reduce((s, p) => s + p.za, 0);
    const no = m.parties.reduce((s, p) => s + p.protiv + p.vazdrzhal, 0);
    if (za > no) pick = m;
  }
  if (!pick) {
    console.log(JSON.stringify({ error: "не е намерено гласуване" }));
    return;
  }
  console.log(JSON.stringify({
    stenId: Number(stenId), stenDate: sten.Pl_Sten_date,
    topic: pick.topic.slice(0, 200),
    votes: {
      za: pick.parties.reduce((s, p) => s + p.za, 0),
      protiv: pick.parties.reduce((s, p) => s + p.protiv, 0),
      vazdrzhal: pick.parties.reduce((s, p) => s + p.vazdrzhal, 0),
    },
    votesByParty: pick.parties,
  }, null, 1));
}
main();
