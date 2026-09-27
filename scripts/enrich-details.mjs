/**
 * Извлича структурирани данни за приет закон от parliament.bg API.
 * Източникът на истина е L_ActL_final_body (пълният текст от ДВ):
 * указ, дати, президент, председател, променени членове, влизане в сила.
 *
 * Употреба: node scripts/enrich-details.mjs <actId> [actId...]
 * Изход: JSON с чернова в stdout.
 */
const API = "https://www.parliament.bg/api/v1/act";

const MONTHS = {
  "януари": "01", "февруари": "02", "март": "03", "април": "04",
  "май": "05", "юни": "06", "юли": "07", "август": "08",
  "септември": "09", "октомври": "10", "ноември": "11", "декември": "12",
};

const bgDate = (d, m, y) =>
  `${y}-${MONTHS[m.toLowerCase()] || "01"}-${String(d).padStart(2, "0")}`;

function strip(html) {
  return (html || "")
    .replace(/<script.*?<\/script>/gs, " ")
    .replace(/<!--.*?-->/gs, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&sect;/g, "§")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&bdquo;|&#8222;/g, "„")
    .replace(/&ldquo;|&#8220;/g, "“")
    .replace(/&ndash;|&#8211;/g, "–")
    .replace(/&mdash;|&#8212;/g, "—")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function parseAct(d) {
  const text = strip(d.L_ActL_final_body);
  const out = {
    actId: d.L_Act_id,
    title: d.L_ActL_final || d.L_ActL_title,
    sign: d.L_Act_sign,
    nsFolder: d.A_ns_folder || null,
    dv: d.L_Act_dv_iss && d.L_Act_dv_year ? `ДВ, бр. ${d.L_Act_dv_iss}/${d.L_Act_dv_year}` : null,
  };
  let m;
  m = text.match(/приет от (\d+)[-–\s]*[а-я]*\s*Народно събрание на (\d{1,2}) ([а-я]+) (\d{4})/i);
  if (m) {
    out.nsAdopted = Number(m[1]);
    out.dateAdopted = bgDate(m[2], m[3], m[4]);
  }
  m = text.match(/повторно приет на (\d{1,2}) ([а-я]+) (\d{4})/i);
  if (m) out.dateReadopted = bgDate(m[1], m[2], m[3]);
  m = text.match(/УКАЗ №\s*(\d+)/i);
  if (m) out.decreeNo = `№ ${m[1]}`;
  m = text.match(/Издаден в София на (\d{1,2}) ([а-я]+) (\d{4})/i);
  if (m) out.dateDecree = bgDate(m[1], m[2], m[3]);
  m = text.match(/Президент на [Рр]епубликата:\s*([А-ЯA-Z][^.,;]{3,40})/);
  if (m) out.president = m[1].trim();
  m = text.match(/Председател на Народното събрание:\s*([А-ЯA-Z][^.,;]{3,40})/);
  if (m) out.chair = m[1].trim();
  m = text.match(/[Мм]инистър на правосъдието:\s*([А-ЯA-Z][^.,;]{3,40})/);
  if (m) out.justiceMinister = m[1].trim();
  m = text.match(/[Зз]аконът влиза в сила (.{5,160}?)(?:\.|$)/);
  if (m) out.effectiveNote = m[1].trim().slice(0, 160);
  // променени членове: "§ 5. В чл. 97 ..." / "Член 268 се изменя" /
  // "Създава се чл. 56а" / номерирани точки "1. В чл. 11 ..."
  const members = [];
  const seen = new Set();
  const re = /(?:§\s*(\d+)\.|(?<![\d§])(\d{1,3})\.)\s*(В чл\. (\d+[а-я]*)|Член (\d+[а-я]*)|Създава се чл\. (\d+[а-я]*)|Чл\. (\d+[а-я]*) се (?:отменя|изменя))/g;
  // „Параграф единствен. В чл. 244 ...“
  const reSingle = /Параграф единствен\.\s*(?:В (чл\. (\d+[а-я]*))|(Член (\d+[а-я]*) се [^.]{0,60}))/g;
  let mm;
  while ((mm = re.exec(text)) !== null && members.length < 25) {
    const para = mm[1] || mm[2];
    const chl = mm[4] || mm[5] || mm[6] || mm[7];
    const key = `${para}/${chl}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const start = mm.index;
    const snippet = text.slice(start, start + 400).replace(/^§\s*\d+\.\s*/, "").slice(0, 300);
    members.push({ para: `§ ${para}`, member: `чл. ${chl}`, snippet });
  }
  out.members = members;
  if (members.length === 0) {
    let ms;
    if ((ms = reSingle.exec(text)) !== null) {
      const chl = ms[2] || ms[4];
      if (chl) members.push({ para: "§ единствен", member: `чл. ${chl}`, snippet: text.slice(ms.index, ms.index + 350).slice(0, 300) });
    }
  }
  out.textLen = text.length;
  return out;
}

async function main() {
  const ids = process.argv.slice(2).map(Number).filter(Boolean);
  if (!ids.length) {
    console.error("Употреба: node scripts/enrich-details.mjs <actId> [...]");
    process.exit(1);
  }
  const results = [];
  for (const id of ids) {
    const res = await fetch(`${API}/${id}`, { headers: { "User-Agent": "zad-zakona-enrich/0.1" } });
    if (!res.ok) {
      console.error(`! act ${id}: HTTP ${res.status}`);
      continue;
    }
    const d = await res.json();
    if (!d || !d.L_Act_id) {
      console.error(`! act ${id}: празно`);
      continue;
    }
    results.push(parseAct(d));
    await new Promise((r) => setTimeout(r, 600));
  }
  console.log(JSON.stringify(results, null, 1));
}

main();
