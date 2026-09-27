/**
 * Гласуване по дата: стенограма (archive-period) → gv CSV → последен вот за закона.
 * Употреба: node scripts/extract-vote.mjs <nsNum> <YYYY-MM-DD> <keyword...>  (stdout JSON)
 */
const API = "https://www.parliament.bg/api/v1";
const UA = "zad-zakona-votes/0.1";
const NS_API = { 44: 52, 45: 55, 46: 56, 47: 57, 48: 58, 49: 59, 50: 60, 51: 61, 52: 62 };
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

async function main() {
  const [nsNum, dateIso, ...kws] = process.argv.slice(2);
  const kwsL = kws.map((k) => k.toLowerCase());
  const [y, m] = dateIso.split("-").map(Number);
  const pers = await (await jget(`${API}/archive-period/bg/Pl_StenV/${y}/${m}/0/0`)).json();
  const cands = pers.filter((p) => Math.abs(new Date(p.t_date) - new Date(dateIso)) / 864e5 <= 2);
  for (const c of cands) {
    const sten = await (await jget(`${API}/pl-sten/${c.t_id}`)).json();
    await sleep(400);
    const csvs = (sten.files || []).filter((f) => f.Pl_StenDfile && f.Pl_StenDfile.endsWith(".csv"));
    if (!csvs.length) continue;
    let mine = [];
    const seen = new Set();
    for (const csv of csvs) {
      const text = await (await jget("https://www.parliament.bg" + csv.Pl_StenDfile)).text();
      await sleep(400);
      const rows = text.split(/\r?\n/).slice(1).map((l) =>
        l.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((x) => x.replace(/^"|"$/g, ""))
      );
      for (const r of rows) {
        if (!r[0] || !kwsL.every((k) => r[0].toLowerCase().includes(k))) continue;
        const key = r[0] + "||" + r[9];
        if (seen.has(key)) continue;
        seen.add(key);
        mine.push(r);
      }
    }
    if (!mine.length) continue;
    const topics = [...new Set(mine.map((r) => r[0]))];
    // два формата CSV: стар [party,za,pr,vz,tot] / нов [party,'50',za,pr,vz,tot]
    const parseRow = (r) => {
      const nums = r.slice(10).filter((x) => /^\d+$/.test(x)).map(Number);
      if (nums.length >= 5) return { party: r[9], za: nums[1], protiv: nums[2], vazdrzhal: nums[3] };
      return { party: r[9], za: nums[0] || 0, protiv: nums[1] || 0, vazdrzhal: nums[2] || 0 };
    };
    // финалният вот = последният ПРИЕТ (за > против + въздържали се)
    let pick = null;
    const cands = [];
    for (const t of topics) {
      const vp = mine.filter((r) => r[0] === t).map(parseRow);
      const za = vp.reduce((s, p) => s + p.za, 0);
      const no = vp.reduce((s, p) => s + p.protiv + p.vazdrzhal, 0);
      cands.push({ t, za, no });
      if (za > no) pick = { topic: t, votes: vp };
    }
    console.error("CANDIDATES: " + JSON.stringify(cands.map((c) => `${c.za}/${c.no} ${c.t.slice(0, 90)}`)));
    if (!pick) continue;
    const byParty = pick.votes;
    console.log(JSON.stringify({
      stenId: c.t_id, stenDate: c.t_date,
      stenUrl: `https://www.parliament.bg/bg/plenaryst/ns/${NS_API[Number(nsNum)]}/ID/${c.t_id}`,
      topic: pick.topic.slice(0, 180),
      votes: {
        za: byParty.reduce((s, p) => s + p.za, 0),
        protiv: byParty.reduce((s, p) => s + p.protiv, 0),
        vazdrzhal: byParty.reduce((s, p) => s + p.vazdrzhal, 0),
      },
      votesByParty: byParty,
    }, null, 1));
    return;
  }
  console.log(JSON.stringify({ error: "не е намерено гласуване" }));
}
main();
