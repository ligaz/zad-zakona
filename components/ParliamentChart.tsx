"use client";

import { useState } from "react";
import type { PartyVote } from "@/lib/types";
import { partyColor, seatOrder } from "@/lib/parties";

const C = { za: "#10b981", protiv: "#f43f5e", vazdrzhal: "#a1a1aa", empty: "var(--chart-empty)" };

interface Cell {
  x: number;
  y: number;
  fill: string;
  label: string;
  party: string;
  vote: string;
}

/**
 * Зала като в парламента: квадратчета в 3 блока — лява и дясна ложа по 4 на ред
 * (9 реда), в средата ветрило 8, 9, …, 19 + преден ред 6. Общо 72 + 168 = 240.
 * Фонът на блока е в цвета на партията, а квадратчетата показват гласа
 * (зелено/червено/сиво).
 */
const MIDDLE = [19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9]; // 11 нива = 154, отдолу нагоре 9,10,11…
const S = 16; // страна на квадратчето
const G = 4; // разстояние
const CELL = S + G;
const BGAP = 18; // разстояние между блоковете — НЕ се стеснява (правило:
// залата е на 3 блока като истинската; мостовете ложа–среда са част от
// картата на съседите, а „един до друг“ се мери по картата, не евклидово)
const W = 560;
const PADY = 8;
const H = PADY * 2 + MIDDLE.length * CELL - G;

export function ParliamentChart({
  groups,
  total = 240,
  colorBy = "party",
  assemblyId,
}: {
  groups: PartyVote[];
  total?: number;
  colorBy?: "vote" | "party";
  assemblyId?: string;
}) {
  const dots: { fill: string; label: string; party: string; vote: string }[] = [];
  // ред отляво надясно по местата в залата (при равенство — големите първи)
  const bySeat = (a: PartyVote, b: PartyVote) =>
    seatOrder(a.party, assemblyId) - seatOrder(b.party, assemblyId) ||
    b.za + b.protiv + b.vazdrzhal - (a.za + a.protiv + a.vazdrzhal);
  const ordered = [...groups].sort(bySeat);
  for (const g of ordered) {
    // ПРОБА: квадратчето е в цвета на партията (фонът показва гласа)
    const pc = partyColor(g.party);
    const push = (n: number, vote: string) => {
      for (let i = 0; i < n; i++)
        dots.push({ fill: colorBy === "party" && g.party ? pc : vote === "за" ? C.za : vote === "против" ? C.protiv : C.vazdrzhal, label: [g.party, vote].filter(Boolean).join(" — "), party: g.party, vote });
    };
    push(g.za, "за");
    push(g.protiv, "против");
    push(g.vazdrzhal, "въздържал се");
  }
  while (dots.length < total)
    dots.push({ fill: C.empty, label: "Негласувал / отсъстващ", party: "", vote: "" });
  const items = dots.slice(0, total);
  // Без поименна разбивка: последователно запълване от първите (горни) редове.
  const anonymous = groups.length > 0 && groups.every((g) => !g.party);

  // слотове ред по ред: ниво L = [лява ложа] + [среда M[L]] + [дясна ложа];
  // ложите са 4 на ред, най-горното ниво е по 3. Попълване последователно.
  interface Slot {
    x: number;
    y: number;
  }
  const rows: Slot[][] = [];
  const midW = (m: number) => m * CELL - G;
  for (let L = 0; L < MIDDLE.length; L++) {
    const y = PADY + L * CELL;
    const row: Slot[] = [];
    const my = midW(MIDDLE[L]);
    const xMid = (W - my) / 2;
    const sideN = L === 0 ? 3 : 4;
    const sideW = sideN * CELL - G;
    // ложите следват ръба на средата: навътре надолу, навън нагоре
    const xLeft = xMid - BGAP - sideW;
    const xRight = xMid + my + BGAP;
    for (let i = 0; i < sideN; i++) row.push({ x: xLeft + i * CELL, y });
    for (let i = 0; i < MIDDLE[L]; i++) row.push({ x: xMid + i * CELL, y });
    for (let i = 0; i < sideN; i++) row.push({ x: xRight + i * CELL, y });
    rows.push(row);
  }

  // попълване: редовете се броят ОТДОЛУ (1-ви ред е най-долният).
  // Flood-fill на кръгове: всяка партия расте от семената си в долния ред —
  // блокът е непрекъснат, а всяка партия стъпва долу.
  const cells: Cell[] = [];
  const rowParty: string[][] = rows.map(() => []);
  if (!anonymous) {
    const key = (r: number, si: number) => `${r},${si}`;
    // съседи (4-свързаност + допуск за пролуката ложа–среда)
    const neighbors = new Map<string, { r: number; si: number }[]>();
    // гео-съседи: същото без мостовете (>20.5px) — за „един до друг“ буквално
    const geoNb = new Map<string, { r: number; si: number }[]>();
    const cheb = (a: { r: number; si: number }, b: { r: number; si: number }) =>
      Math.max(
        Math.abs(rows[a.r][a.si].x - rows[b.r][b.si].x),
        Math.abs(rows[a.r][a.si].y - rows[b.r][b.si].y),
      );
    for (let r = 0; r < rows.length; r++) {
      rows[r].forEach((s, si) => {
        const list: { r: number; si: number }[] = [];
        if (si > 0) list.push({ r, si: si - 1 });
        if (si < rows[r].length - 1) list.push({ r, si: si + 1 });
        // вертикални връзки: ВСИЧКИ клетки от съседния ред в обхват (симетрия:
        // „най-близка“ при равенство избира различно в двете посоки и картата
        // се разминава с геометрията — фалшиви разкъсвания)
        for (const dr of [-1, 1]) {
          const nr = r + dr;
          if (nr < 0 || nr >= rows.length) continue;
          rows[nr].forEach((t, ti) => {
            if (Math.abs(t.x - s.x) <= CELL) list.push({ r: nr, si: ti });
          });
        }
        neighbors.set(key(r, si), list);
        geoNb.set(
          key(r, si),
          list.filter((nb) => cheb({ r, si }, nb) <= 20.5),
        );
      });
    }
    const queues = new Map<string, typeof items>();
    for (const d of items) {
      if (!queues.has(d.party)) queues.set(d.party, []);
      queues.get(d.party)!.push(d);
    }
    const order = [...queues.keys()].sort((a, b) => {
      if (!a) return 1;
      if (!b) return -1;
      return seatOrder(a, assemblyId) - seatOrder(b, assemblyId);
    });
    const free = new Set<string>();
    for (let r = 0; r < rows.length; r++) {
      rows[r].forEach((_, si) => free.add(key(r, si)));
    }
    const place = (r: number, si: number, d: (typeof items)[number]) => {
      cells.push({ x: rows[r][si].x, y: rows[r][si].y, fill: d.fill, label: d.label, party: d.party, vote: d.vote });
      rowParty[r][si] = d.party;
      free.delete(key(r, si));
    };
    const isIndep = (p: string) => p === "независими";
    const bottom4 = (r: number) => r >= rows.length - 4;
    const realParties = order.filter((p) => p);
    // регион на партията (заетите ѝ клетки) + център по x на семената
    const region = new Map<string, { r: number; si: number }[]>();
    const regionSet = new Map<string, Set<string>>();
    const seedCX = new Map<string, number>();
    const addToRegion = (p: string, r: number, si: number) => {
      if (!region.has(p)) {
        region.set(p, []);
        regionSet.set(p, new Set());
      }
      region.get(p)!.push({ r, si });
      regionSet.get(p)!.add(key(r, si));
    };
    // фаза 0: долният ред — дялове пропорционално на дял от 240 (без независими);
    // семената се пазят (център по x) за flood-fill
    {
      const r = rows.length - 1;
      const cont = realParties.filter((p) => !isIndep(p) && (queues.get(p)?.length ?? 0) > 0);
      const quotas = cont.map((p) => (queues.get(p)!.length / 240) * rows[r].length);
      // всяка партия стъпва долу: минимум 1 клетка (квотата не може да закръгли към 0);
      // при препълване на реда се свива от най-големите (минимумът 1 се пази)
      const finalN = quotas.map((q) => Math.max(1, Math.floor(q)));
      while (finalN.reduce((s, x) => s + x, 0) > rows[r].length) {
        let bi = -1;
        for (let i = 0; i < finalN.length; i++) {
          if (finalN[i] > 1 && (bi < 0 || finalN[i] > finalN[bi])) bi = i;
        }
        if (bi < 0) break;
        finalN[bi]--;
      }
      let left = rows[r].length - finalN.reduce((s, x) => s + x, 0);
      const byFrac = quotas.map((q, i) => i).sort((a, b) => quotas[b] - Math.floor(quotas[b]) - (quotas[a] - Math.floor(quotas[a])));
      // кръгова лотария: долният ред се запълва докрай (иначе остават сиви
      // клетки долу); всяка партия взима най-много +1 на обиколка
      let filled = true;
      while (left > 0 && filled) {
        filled = false;
        for (const i of byFrac) {
          if (left <= 0) break;
          if (finalN[i] < queues.get(cont[i])!.length) {
            finalN[i]++;
            left--;
            filled = true;
          }
        }
      }
      let si = 0;
      cont.forEach((p, i) => {
        let sx = 0;
        for (let j = 0; j < finalN[i] && si < rows[r].length; j++, si++) {
          const d = queues.get(p)!.shift()!;
          const s = rows[r][si];
          sx += s.x;
          place(r, si, d);
          addToRegion(p, r, si);
        }
        if (finalN[i] > 0) seedCX.set(p, sx / finalN[i]);
      });
      // (без стълбове в какъвто и да е вариант: измерено 177/232/466/487
      // срещу 45 базови — всяко принудително заемане къса; вж repair по-долу)
    }
    // фаза 1: кръгов растеж от семената (виж roundOrder по-долу)
    {
      const remaining = new Map(realParties.map((p) => [p, queues.get(p)!.length]));
      // (без резервации: flood-ът расте свързано от собствените си семена;
      // прескачането на чужди колони фрагментираше блоковете)
      // независимите нямат семена (изключени от фаза 0): семе = най-дясното свободно позволено място
      for (const p of realParties) {
        if ((region.get(p) ?? []).length > 0 || (remaining.get(p) ?? 0) <= 0) continue;
        let best: { r: number; si: number } | null = null;
        let bestX = -Infinity;
        for (let r = 0; r < rows.length; r++) {
          if (isIndep(p) && bottom4(r)) continue;
          for (let si = 0; si < rows[r].length; si++) {
            if (!free.has(key(r, si))) continue;
              if (rows[r][si].x > bestX) {
              bestX = rows[r][si].x;
              best = { r, si };
            }
          }
        }
        if (best) {
          seedCX.set(p, rows[best.r][best.si].x);
          const d = queues.get(p)!.shift()!;
          remaining.set(p, remaining.get(p)! - 1);
          place(best.r, best.si, d);
          addToRegion(p, best.r, best.si);
        }
      }
      // кръгов растеж: всички партии растат едновременно, по една точка на кръг
      // (иначе ранните обграждат семената на късните и ги откъсват);
      // във всеки кръг най-застрашените са първи (най-малко свободен фронт —
      // иначе съседите им изяждат последните клетки и ги откъсват);
      // семената пазят секторите, допирът пази плътността
      const frontierSize = (p: string): number => {
        let n = 0;
        for (const cell of region.get(p) ?? []) {
          for (const nb of neighbors.get(key(cell.r, cell.si)) ?? []) {
            if (!free.has(key(nb.r, nb.si))) continue;
            if (isIndep(p) && bottom4(nb.r)) continue;
            n++;
          }
        }
        return n;
      };
      let guard = 240 * realParties.length + 100;
      let progress = true;
      // мека лента около сектора: полуширина според квотата (големите имат
      // нужда от място, малките стоят в ложата си); извън лентата — штраф
      const laneHalf = new Map<string, number>();
      for (const p of realParties) {
        const total = (region.get(p) ?? []).length + (remaining.get(p) ?? 0);
        laneHalf.set(p, Math.max(25, total * 1.8));
      }
      while (progress && guard-- > 0) {
        progress = false;
        // най-застрашените първи (най-малко свободен фронт);
        // големите пазят лентите си сами (широки фронтове + лента)
        const roundOrder = [...realParties].sort((a, b) =>
          frontierSize(a) - frontierSize(b) ||
          (queues.get(a)?.length ?? 0) - (queues.get(b)?.length ?? 0),
        );
        for (const p of roundOrder) {
          if ((remaining.get(p) ?? 0) <= 0) continue;
          const reg = region.get(p) ?? [];
          const cx = seedCX.get(p) ?? 0;
          const half = laneHalf.get(p) ?? 25;
          let best: { r: number; si: number } | null = null;
          let bestScore = Infinity;
          const own = regionSet.get(p) ?? new Set<string>();
          for (const cell of reg) {
            for (const nb of neighbors.get(key(cell.r, cell.si)) ?? []) {
              if (!free.has(key(nb.r, nb.si))) continue;
              if (isIndep(p) && bottom4(nb.r)) continue;
              // плътен блок: първо клетките с най-много допир до региона
              // (запълва вдлъбнатини, не пуска пипала), после най-ниските
              // (разширяване в ширина, не кула нагоре — те се обграждат
              // и късат), после избягване на чужд допир (фронтовете спират
              // на границата, не се преплитат), после близост до семената
              // и накрая штраф извън лентата (секторът се пази, но препълване
              // е позволено — свързаността е над чистотата)
              let contact = 0;
              let rival = 0;
              for (const nn of neighbors.get(key(nb.r, nb.si)) ?? []) {
                if (own.has(key(nn.r, nn.si))) contact++;
                else if (rowParty[nn.r][nn.si] && rowParty[nn.r][nn.si] !== p) rival++;
              }
              const over =
                Math.max(0, Math.abs(rows[nb.r][nb.si].x - cx) - half) * 20000;
              const score =
                -contact * 100000 +
                rival * 50000 +
                (rows.length - nb.r) * 50000 +
                Math.abs(rows[nb.r][nb.si].x - cx) * 1000 +
                over;
              if (score < bestScore) {
                bestScore = score;
                best = nb;
              }
            }
          }
          // резерва: най-близкото свободно позволено място до региона
          // (парчето остава долепено до блока, а не през залата),
          // с предпочитание вътре в лентата (без бягство в чужд сектор)
          if (!best) {
            let bd = Infinity;
            for (let r = 0; r < rows.length; r++) {
              if (isIndep(p) && bottom4(r)) continue;
              rows[r].forEach((s, si) => {
                if (!free.has(key(r, si))) return;
                let dd = Infinity;
                for (const cell of reg) {
                  const ddx = Math.abs(s.x - rows[cell.r][cell.si].x);
                  const ddy = Math.abs(s.y - rows[cell.r][cell.si].y);
                  const d = Math.max(ddx, ddy);
                  if (d < dd) dd = d;
                }
                dd += Math.max(0, Math.abs(s.x - cx) - half) * 10;
                if (dd < bd) {
                  bd = dd;
                  best = { r, si };
                }
              });
            }
          }
          if (!best) continue;
          const d = queues.get(p)!.shift()!;
          remaining.set(p, remaining.get(p)! - 1);
          place(best.r, best.si, d);
          addToRegion(p, best.r, best.si);
          progress = true;
        }
      }
    }
    // негласувалите: един компактен блок горе вдясно (flood от най-горната дясна клетка)
    {
      const empQ = queues.get("") ?? [];
      let ei = 0;
      const empLeft = () => empQ.length - ei;
      while (empLeft() > 0) {
        let seed: { r: number; si: number } | null = null;
        let bestX = -Infinity;
        let bestY = Infinity;
        for (let r = 0; r < rows.length; r++) {
          for (let si = 0; si < rows[r].length; si++) {
            if (!free.has(key(r, si))) continue;
            const s = rows[r][si];
            if (s.x > bestX || (s.x === bestX && r < bestY)) {
              bestX = s.x;
              bestY = r;
              seed = { r, si };
            }
          }
        }
        if (!seed) break;
        const seen = new Set<string>([key(seed.r, seed.si)]);
        const stack = [seed];
        while (stack.length > 0 && empLeft() > 0) {
          const cur = stack.pop()!;
          const k = key(cur.r, cur.si);
          if (!free.has(k)) continue;
          const d = empQ[ei++];
          place(cur.r, cur.si, d);
          for (const nb of neighbors.get(k) ?? []) {
            const nk = key(nb.r, nb.si);
            if (free.has(nk) && !seen.has(nk)) {
              seen.add(nk);
              stack.push(nb);
            }
          }
        }
      }
    }
    // repair: долепяне на откъснати точки чрез размяна със съседна чужда
    // клетка (бройките се пазят — точките си сменят местата). Всяка размяна
    // се проверява (свързаност на двете партии + долен ред) — иначе откат.
    // Не пипа растежа, оправя само сателитите.
    // ZZ_NOREPAIR=1 го изключва (за базово измерване).
    const noRepair =
      typeof process !== "undefined" && process.env.ZZ_NOREPAIR === "1";
    if (!noRepair) {
    {
      const constrained = (p: string) => !!p && p !== "независими";
      const cellsOf = (p: string) => {
        const out: { r: number; si: number }[] = [];
        for (let r = 0; r < rows.length; r++)
          rows[r].forEach((_, si) => {
            if (rowParty[r][si] === p) out.push({ r, si });
          });
        return out;
      };
      const connected = (list: { r: number; si: number }[]): boolean => {
        if (list.length < 2) return true;
        const set = new Set(list.map((c) => key(c.r, c.si)));
        const stack = [list[0]];
        const seen = new Set<string>([key(list[0].r, list[0].si)]);
        while (stack.length > 0) {
          const cur = stack.pop()!;
          for (const nb of neighbors.get(key(cur.r, cur.si)) ?? []) {
            const k = key(nb.r, nb.si);
            if (set.has(k) && !seen.has(k)) {
              seen.add(k);
              stack.push(nb);
            }
          }
        }
        return seen.size === list.length;
      };
      const componentsOf = (
        list: { r: number; si: number }[],
        graph: Map<string, { r: number; si: number }[]> = neighbors,
      ) => {
        const set = new Set(list.map((c) => key(c.r, c.si)));
        const rest = new Set(set);
        const comps: { r: number; si: number }[][] = [];
        const byKey = new Map(list.map((c) => [key(c.r, c.si), c]));
        while (rest.size > 0) {
          const first = byKey.get([...rest][0])!;
          const comp = [first];
          const seen = new Set<string>([key(first.r, first.si)]);
          const stack = [first];
          rest.delete(key(first.r, first.si));
          while (stack.length > 0) {
            const cur = stack.pop()!;
            for (const nb of graph.get(key(cur.r, cur.si)) ?? []) {
              const k = key(nb.r, nb.si);
              if (set.has(k) && !seen.has(k)) {
                seen.add(k);
                rest.delete(k);
                const cell = byKey.get(k)!;
                comp.push(cell);
                stack.push(cell);
              }
            }
          }
          comps.push(comp);
        }
        comps.sort((a, b) => b.length - a.length);
        return comps;
      };
      const touchesBottom = (list: { r: number; si: number }[]) =>
        list.some((c) => c.r === rows.length - 1);
      const findCell = (r: number, si: number) =>
        cells.find((c) => c.x === rows[r][si].x && c.y === rows[r][si].y)!;
      // общ бюджет за размените на страницата: repair-ите на партиите иначе
      // се канибализират (Q краде оправеното на P) — измерено 473 срещу 43.
      // Бюджетът е НА ПАРТИЯ (глобалният гладуваше късните партии — ДБ не
      // стигаше изобщо до repair). settled пази от цикли d↔e при ≤-прогрес.
      const settled = new Set<string>();
      for (const p of realParties) {
        let guard = 150;
        const all = cellsOf(p);
        if (all.length < 2) continue;
        // гео-компоненти (без мостове): „един до друг“ буквално
        const gcomps = componentsOf(all, geoNb);
        if (gcomps.length < 2) continue;
        const hadBottom = touchesBottom(all);
        let minors = gcomps.slice(1).flat();
        if (minors.length > 40) continue;
        while (minors.length > 0 && guard > 0) {
          const J = componentsOf(cellsOf(p), geoNb)[0];
          // прогрес върху БРОЙ ПАРЧЕТА (≤): роненето е позволено, само ако
          // не цепи (парчетата никога не растат) — чънковете се стопяват
          // dot by dot. Строгият < оправя само единични сателити.
          const piecesBefore = componentsOf(cellsOf(p), geoNb).length;
          let moved = false;
          for (const jc of J) {
            if (moved) break;
            // e: чужда клетка долепена до J — първо сивите/независимите
            // (безусловни, винаги безопасни), после гласувалите
            const nbs = [...(neighbors.get(key(jc.r, jc.si)) ?? [])].sort(
              (a, b) =>
                (constrained(rowParty[a.r][a.si] ?? "") ? 1 : 0) -
                (constrained(rowParty[b.r][b.si] ?? "") ? 1 : 0),
            );
            for (const nb of nbs) {
              if (moved) break;
              const rp = rowParty[nb.r][nb.si];
              if (rp === p) continue;
              for (const d of minors) {
                guard--;
                if (settled.has(key(d.r, d.si))) continue;
                const e = { r: nb.r, si: nb.si };
                if (settled.has(key(e.r, e.si))) continue;
                // строг прогрес: гео-сателитите намаляват (иначе откат) —
                // това гарантира край и че не се създават нови разкъсвания
                const pAfter = cellsOf(p)
                  .filter((c) => key(c.r, c.si) !== key(d.r, d.si))
                  .concat([e]);
                const piecesAfter = componentsOf(pAfter, geoNb).length;
                const rAll = cellsOf(rp);
                const hadBottomR = touchesBottom(rAll);
                const rCells = rAll.filter(
                  (c) => key(c.r, c.si) !== key(e.r, e.si),
                );
                const rNew = rCells.concat([d]);
                const okP =
                  connected(pAfter) &&
                  piecesAfter <= piecesBefore &&
                  (!hadBottom || touchesBottom(pAfter));
                const okR =
                  !constrained(rp) ||
                  (connected(rNew) && (!hadBottomR || touchesBottom(rNew)));
                if (!okP || !okR) {
                  if (guard <= 0) break;
                  continue;
                }
                const cd = findCell(d.r, d.si);
                const ce = findCell(e.r, e.si);
                if (!cd || !ce) {
                  if (guard <= 0) break;
                  continue;
                }
                const tmp = { party: cd.party, vote: cd.vote, label: cd.label, fill: cd.fill };
                cd.party = ce.party;
                cd.vote = ce.vote;
                cd.label = ce.label;
                cd.fill = ce.fill;
                ce.party = tmp.party;
                ce.vote = tmp.vote;
                ce.label = tmp.label;
                ce.fill = tmp.fill;
                rowParty[d.r][d.si] = rp;
                rowParty[e.r][e.si] = p;
                settled.add(key(d.r, d.si));
                settled.add(key(e.r, e.si));
                moved = true;
                break;
              }
            }
          }
          if (!moved) break;
          minors = componentsOf(cellsOf(p), geoNb).slice(1).flat();
        }
      }
      // финал: долният ред е само за гласували — сивите долни клетки се
      // разменят с най-горни точки (проверено: без нови разкъсвания)
      {
        const bot = rows.length - 1;
        const grayBottom = rows[bot]
          .map((_, si) => si)
          .filter((si) => rowParty[bot][si] === "");
        for (const si of grayBottom) {
          const g = { r: bot, si };
          let done = false;
          for (const p of realParties) {
            if (done) break;
            // донор: която и да е точка (най-горните първи — сивото отива
            // нагоре, не в дъното), стига блокът да остане свързан
            const tops = cellsOf(p).sort((a, b) => a.r - b.r);
            for (const c of tops) {
              const rest = cellsOf(p).filter(
                (x) => key(x.r, x.si) !== key(c.r, c.si),
              );
              if (!connected(rest)) {
                continue;
              }
              const gAdj = (
                neighbors.get(key(g.r, g.si)) ?? []
              ).some((nb) => {
                const k = key(nb.r, nb.si);
                return (
                  k !== key(c.r, c.si) &&
                  rest.some((x) => key(x.r, x.si) === k)
                );
              });
              if (!gAdj) {
                continue;
              }
              const cd = findCell(c.r, c.si);
              const ce = findCell(g.r, g.si);
              if (!cd || !ce) continue;
              const tmp = {
                party: cd.party,
                vote: cd.vote,
                label: cd.label,
                fill: cd.fill,
              };
              cd.party = ce.party;
              cd.vote = ce.vote;
              cd.label = ce.label;
              cd.fill = ce.fill;
              ce.party = tmp.party;
              ce.vote = tmp.vote;
              ce.label = tmp.label;
              ce.fill = tmp.fill;
              rowParty[c.r][c.si] = "";
              rowParty[g.r][g.si] = p;
              done = true;
              break;
            }
          }
        }
      }
    }
  }
  }
  // Без поименна разбивка: последователно запълване от първите (долни) редове.
  if (anonymous) {
    let k = 0;
    for (let r = rows.length - 1; r >= 0 && k < items.length; r--) {
      for (let si = 0; si < rows[r].length && k < items.length; si++, k++) {
        const d = items[k];
        cells.push({ x: rows[r][si].x, y: rows[r][si].y, fill: d.fill, label: d.label, party: d.party, vote: d.vote });
        rowParty[r][si] = d.party;
      }
    }
  }

  // ПРОБА: квадратчето е в цвета на партията, фонът е гласът
  const bands: { x: number; y: number; fill: string; label: string; party: string; vote: string }[] = [];
  if (colorBy === "party") {
    const voteFill = (v: string) => (v === "за" ? C.za : v === "против" ? C.protiv : C.vazdrzhal);
    for (const d of cells) {
      if (!d.party) continue;
      bands.push({ x: d.x - 4, y: d.y - 4, fill: voteFill(d.vote), label: d.label, party: d.party, vote: d.vote });
    }
  }

  const zaTotal = groups.reduce((s, g) => s + g.za, 0);
  const protivTotal = groups.reduce((s, g) => s + g.protiv, 0);
  const vzdTotal = groups.reduce((s, g) => s + g.vazdrzhal, 0);

  const [voteFilter, setVoteFilter] = useState<"за" | "против" | "въздържал се" | null>(null);
  const [partySel, setPartySel] = useState<string | null>(null);

  const matchCell = (d: { vote: string; party: string }) =>
    (!voteFilter || d.vote === voteFilter) && (!partySel || d.party === partySel);

  const byVote = (vote: "за" | "против" | "въздържал се") =>
    groups
      .filter((g) => (vote === "за" ? g.za : vote === "против" ? g.protiv : g.vazdrzhal) > 0)
      .sort((a, b) => (vote === "за" ? b.za - a.za : vote === "против" ? b.protiv - a.protiv : b.vazdrzhal - a.vazdrzhal))
      .map((g) => `${g.party} (${vote === "за" ? g.za : vote === "против" ? g.protiv : g.vazdrzhal})`)
      .join(", ");
  const filterCount = voteFilter === "за" ? zaTotal : voteFilter === "против" ? protivTotal : vzdTotal;
  const filterStyle =
    voteFilter === "за"
      ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
      : voteFilter === "против"
        ? "bg-rose-50 text-rose-900 dark:bg-rose-950 dark:text-rose-200"
        : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
  const filterWord = voteFilter === "за" ? "За" : voteFilter === "против" ? "Против" : "Въздържали се";
  const votedByParty = [...groups]
    .filter((g) => g.party)
    .sort(bySeat)
    .map((g) => ({
      party: g.party,
      n: g.za + g.protiv + g.vazdrzhal,
      za: g.za,
      protiv: g.protiv,
      vazdrzhal: g.vazdrzhal,
      color: colorBy === "party" ? partyColor(g.party) : C.za,
    }));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5 text-xs font-medium">
        {(
          [
            { key: null, label: `Всички (${total})`, cls: "border-zinc-300 text-zinc-600 dark:border-zinc-600 dark:text-zinc-300" },
            { key: "за", label: `За (${zaTotal})`, cls: "border-emerald-300 text-emerald-700 dark:text-emerald-400" },
            { key: "против", label: `Против (${protivTotal})`, cls: "border-rose-300 text-rose-700 dark:text-rose-400" },
            { key: "въздържал се", label: `Въздържали се (${vzdTotal})`, cls: "border-zinc-300 text-zinc-500 dark:border-zinc-600 dark:text-zinc-400" },
          ] as const
        ).map((f) => (
          <button
            type="button"
            key={String(f.key)}
            onClick={() => {
              setVoteFilter(voteFilter === f.key ? null : f.key);
              if (f.key === null) setPartySel(null);
            }}
            className={`rounded-full border px-3 py-1 cursor-pointer touch-manipulation select-none ${
              voteFilter === f.key ? "border-accent bg-accent text-white" : `bg-white dark:bg-zinc-900 ${f.cls}`
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <div className="w-full flex-1">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Гласуване: ${zaTotal} за от ${total}`}
        >
          {bands.map((b, idx) => {
            const dim = (partySel && b.party !== partySel) || (voteFilter && b.vote !== voteFilter);
            const pad = dim ? 1 : 4;
            return (
            <rect key={`b${idx}`} x={b.x + (4 - pad)} y={b.y + (4 - pad)} width={S + pad * 2} height={S + pad * 2} rx={6} fill={b.fill} opacity={dim ? 0.04 : 0.75}>
              <title>{b.label}</title>
            </rect>
            );
          })}
          {cells.map((d, idx) => (
            <rect
              key={idx}
              x={d.x}
              y={d.y}
              width={S}
              height={S}
              rx={3.5}
              fill={d.fill}
              opacity={matchCell(d) ? 1 : 0.12}
            >
              <title>{d.label}</title>
            </rect>
          ))}
        </svg>
        {voteFilter && filterCount > 0 && (
          <div className="mt-2 flex justify-center">
              <p className={`max-w-md rounded-xl px-4 py-2 text-center text-xs ${filterStyle}`}>
                <b>{filterWord} ({filterCount}):</b>{" "}
                {anonymous ? "без поименна разбивка" : byVote(voteFilter)}
              </p>
          </div>
        )}
      </div>
      <div className="w-full shrink-0 sm:w-52">
        {anonymous ? (
          <p className="rounded-xl border border-dashed border-zinc-300 p-3 text-xs text-zinc-500 dark:border-zinc-600 dark:text-zinc-400">
            Без поименна разбивка — стенограмата съдържа само общите тотали.
          </p>
        ) : (
        <ul className="space-y-1.5 text-sm">
          {votedByParty.map((p) => {
            const wPct = Math.max((p.n / Math.max(...votedByParty.map((x) => x.n), 1)) * 100, p.n > 0 ? 4 : 0);
            return (
            <li key={p.party}>
              <button
                type="button"
                aria-pressed={partySel === p.party}
                onClick={() => setPartySel(partySel === p.party ? null : p.party)}
                title="Освети групата"
                className={`w-full cursor-pointer touch-manipulation select-none rounded-lg px-1.5 py-1 text-left ${
                  partySel === p.party ? "bg-accent text-white" : "hover:bg-accent/10"
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate" style={{ color: partySel === p.party ? "#fff" : p.color === C.za ? undefined : p.color }}>
                    {p.party} <b className="tabular-nums">({p.n})</b>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <span className={`text-[11px] tabular-nums ${partySel === p.party ? "text-zinc-300" : "text-zinc-500 dark:text-zinc-400"}`}>
                      <b className="text-emerald-600 dark:text-emerald-400">{p.za}</b>/<b className="text-rose-600 dark:text-rose-400">{p.protiv}</b>/{p.vazdrzhal}
                    </span>
                    <i
                      className="inline-block h-3 w-3 shrink-0 rounded-full"
                      style={{ background: p.color }}
                    />
                  </span>
                </span>
                <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-700">
                  <span className="flex h-full overflow-hidden rounded-full" style={{ width: `${wPct}%` }}>
                    <i className="h-full bg-emerald-500" style={{ width: `${p.n ? (p.za / p.n) * 100 : 0}%` }} />
                    <i className="h-full bg-rose-500" style={{ width: `${p.n ? (p.protiv / p.n) * 100 : 0}%` }} />
                    <i className="h-full bg-zinc-400" style={{ width: `${p.n ? (p.vazdrzhal / p.n) * 100 : 0}%` }} />
                  </span>
                </span>
              </button>
            </li>
            );
          })}
        </ul>
        )}
      </div>
    </div>
    </div>
  );
}
