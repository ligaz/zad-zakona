/**
 * Сверка: за всяка извадка намира обявлението в стенограмата и показва какво следва.
 * Употреба: node scripts/verify-picks.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const UA = "zad-zakona-votes/0.1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function body(sid) {
  const f = `/tmp/sten${sid}.txt`;
  if (existsSync(f)) return readFileSync(f, "utf-8");
  const r = await fetch(`https://www.parliament.bg/api/v1/pl-sten/${sid}`, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error("HTTP " + r.status);
  const j = await r.json();
  await sleep(400);
  writeFileSync(f, j.Pl_Sten_body);
  return j.Pl_Sten_body;
}

function clean(t) {
  return t.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

const votes = JSON.parse(readFileSync("/tmp/votes-basics.json", "utf-8"));
for (const e of votes) {
  const p = e.pick;
  if (!p) { console.log(`SKIP ${e.id} (no pick)`); continue; }
  const t = clean(await body(p.stenId));
  await sleep(200);
  // всички обявления с тези числа (толеранс към 'няма'/единствено число)
  const { za, protiv, vazdrzhal } = p.votes;
  const res = [];
  for (const m of t.matchAll(/Гласували[^.]{0,200}/g)) {
    const s = m[0];
    const nums = [...s.matchAll(/(\d+)/g)].map((x) => Number(x[1]));
    const hasZa = s.includes(`за ${za}`);
    const hasPr = protiv === 0 ? /против (няма|0)/.test(s) : s.includes(`против ${protiv}`);
    const hasVz = vazdrzhal === 0
      ? /въздържали се няма/.test(s)
      : vazdrzhal === 1
        ? /въздържал се 1/.test(s)
        : s.includes(`въздържали се ${vazdrzhal}`);
    if (hasZa && hasPr && hasVz) res.push(t.slice(m.index, m.index + 420));
  }
  console.log(`### ${e.id} sten=${p.stenId} ${za}/${protiv}/${vazdrzhal} matches=${res.length}`);
  for (const r of res.slice(0, 3)) console.log("   " + r.slice(0, 380) + "\n");
}
