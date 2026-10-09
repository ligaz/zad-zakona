/**
 * Streaming JSON I/O за data pipeline-а.
 * Четене: stream-json (parser + streamArray). Писане: собствено, на чънкове
 * (без нови зависимости там — байтовете съвпадат точно с JSON.stringify).
 *
 * Защо: файловете са 3–8MB (parse <50ms), но bulk скриптовете презаписваха
 * ЦЕЛИЯ файл на всеки N записа: `writeFileSync(OUT, JSON.stringify(done))`
 * строи гигантски string в паметта (2x peak + GC паузи) и при kill -9 по
 * средата оставя полузаписан файл. Тук писането е на чънкове + атомарно
 * (temp + rename), а четенето на масиви е елемент по елемент.
 *
 * Dict resume файловете (`done` карти) се четат буферирано нарочно — dedup
 * проверката `done[id]` иска random-access така или иначе.
 */
import { createReadStream, createWriteStream, renameSync, unlinkSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { once } from "node:events";
import chain from "stream-chain";
import { parser } from "stream-json";
import { streamArray } from "stream-json/streamers/stream-array.js";

/** Буферирано четене на малък JSON (dict resume файлове, конфиги). */
export async function readJsonFile(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

/**
 * Streaming четене на top-level JSON масив — yield-ва елементите един по един.
 * Ползва stream-json (parser + streamArray през stream-chain): зрял,
 * поддържан, spec-съвместим парсер вместо ръчен скенер.
 * Валидирано срещу JSON.parse върху data/acts-index.json (3916) и
 * data/amendments.json (1547, вложени changes[]).
 */
export async function* readJsonArrayStream(path, { highWaterMark = 65536 } = {}) {
  const pipeline = chain([
    createReadStream(path, { highWaterMark }),
    parser(),
    streamArray(),
  ]);
  try {
    for await (const { value } of pipeline) yield value;
  } catch (e) {
    if (/json-io/.test(e.message)) throw e;
    throw new Error(`json-io: ${path}: ${e.message}`, { cause: e });
  } finally {
    pipeline.destroy();
  }
}

async function writeAtomic(path, genChunks) {
  const tmp = `${path}.tmp-${process.pid}`;
  const ws = createWriteStream(tmp, { encoding: "utf8" });
  try {
    for (const ch of genChunks()) {
      if (!ws.write(ch)) await once(ws, "drain");
    }
    ws.end();
    await once(ws, "finish");
    renameSync(tmp, path);
  } catch (e) {
    ws.destroy();
    try {
      unlinkSync(tmp);
    } catch {
      /* noop */
    }
    throw e;
  }
}

/**
 * Streaming запис на масив. С indent=1 байтовете съвпадат точно с
 * JSON.stringify(arr, null, 1) (празен масив → `[]`).
 */
export function writeJsonArrayFile(path, items, indent = 1) {
  return writeAtomic(path, function* () {
    const it = items[Symbol.iterator]();
    const first = it.next();
    if (first.done) {
      yield "[]";
      return;
    }
    if (!indent) {
      yield "[";
      yield JSON.stringify(first.value);
      for (const el of { [Symbol.iterator]: () => it }) yield "," + JSON.stringify(el);
      yield "]";
      return;
    }
    const pad = " ".repeat(indent);
    yield "[\n";
    let cur = first;
    let needSep = false;
    while (!cur.done) {
      if (needSep) yield ",\n";
      needSep = true;
      yield JSON.stringify(cur.value, null, indent).split("\n").map((ln) => pad + ln).join("\n");
      cur = it.next();
    }
    yield "\n]";
  });
}

/**
 * Streaming запис на dict. Байтовете съвпадат точно с JSON.stringify(obj).
 * Празен обект → `{}`.
 */
export function writeJsonDictFile(path, obj) {
  return writeAtomic(path, function* () {
    yield "{";
    let first = true;
    for (const [k, v] of Object.entries(obj)) {
      if (!first) yield ",";
      first = false;
      yield JSON.stringify(k) + ":" + JSON.stringify(v);
    }
    yield "}";
  });
}

/**
 * Сериализира паралелни save() викове — worker-ите иначе пишат
 * concurrently в един tmp файл.
 */
export function serialSaver(fn) {
  let tail = Promise.resolve();
  return (...args) => {
    const run = tail.then(() => fn(...args));
    tail = run.catch(() => {});
    return run;
  };
}

/**
 * Робустно четене на CLI стойност: връща def при липсващ флаг,
 * липсваща стойност или стойност, която е следващ --флаг.
 */
export function argVal(argv, name, def) {
  const i = argv.indexOf(name);
  if (i < 0) return def;
  const v = argv[i + 1];
  return v === undefined || v.startsWith("--") ? def : v;
}
