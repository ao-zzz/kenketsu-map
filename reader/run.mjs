// 毎朝1回動かすもの：① 読む → ② 確かめる → ③ 書く。
// 結果は data/latest.json と data/history/日付.json。
// 止まったときは status を "stopped" にして、古い値も新しい値も出さない（画面は元のページへ案内する）。
//
// 使い方：node reader/run.mjs
//   APPROVE_BIG_CHANGE=1 をつけると、「不自然な変化」で止まったものを、人が確かめたうえで出す。
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BLOCKS, pageUrl } from "./blocks.mjs";
import { parseStatusPage } from "./parse.mjs";
import { checkShape, cleanDateText, findUnnaturalChange } from "./validate.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "data");

const WAIT_MS = 1500; // ページの間をあける（日赤のサーバーに負担をかけない。表の 8）
const TIMEOUT_MS = 20000;
const MAX_BYTES = 1_000_000;
const USER_AGENT = "kenketsu-map/0.1 (unofficial; reads 7 pages once a day)";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(url) {
  // 決まった住所だけ。転送（リダイレクト）は追わない
  const res = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { "user-agent": USER_AGENT, accept: "text/html" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const type = res.headers.get("content-type") || "";
  if (!type.startsWith("text/html")) throw new Error(`HTML ではない：${type}`);
  const text = await res.text();
  if (text.length > MAX_BYTES) throw new Error("ページが大きすぎる");
  return text;
}

async function readPrevious() {
  try {
    return JSON.parse(await readFile(path.join(DATA, "latest.json"), "utf8"));
  } catch {
    return null;
  }
}

export async function readAll({ fetcher = fetchPage, wait = WAIT_MS } = {}) {
  const blocks = [];
  for (const [i, block] of BLOCKS.entries()) {
    if (i > 0) await sleep(wait);
    const html = await fetcher(pageUrl(block));
    const { dateText, values } = parseStatusPage(html);
    blocks.push({ id: block.id, dateText: cleanDateText(dateText), values });
  }
  return { blocks };
}

export function decide(snapshot, previous, { approveBigChange = false } = {}) {
  const reasons = checkShape(snapshot);
  if (reasons.length) return { status: "stopped", reason: reasons.join(" / ") };
  const unnatural = findUnnaturalChange(snapshot, previous);
  if (unnatural && !approveBigChange) return { status: "stopped", reason: `${unnatural}（人が確かめるまで出さない）` };
  return { status: "ok", blocks: snapshot.blocks };
}

async function main() {
  const checkedAt = new Date().toISOString();
  const previous = await readPrevious();
  let result;
  try {
    const snapshot = await readAll();
    result = decide(snapshot, previous, { approveBigChange: process.env.APPROVE_BIG_CHANGE === "1" });
  } catch (err) {
    result = { status: "stopped", reason: `読み取りで止まった：${err.message}` };
  }
  const out = { checkedAt, ...result };

  await mkdir(path.join(DATA, "history"), { recursive: true });
  const json = JSON.stringify(out, null, 2) + "\n";
  await writeFile(path.join(DATA, "latest.json"), json);
  // 記録のファイル名は日本の日付（checkedAt は世界標準時）
  const jstDate = new Date(Date.parse(checkedAt) + 9 * 3600 * 1000).toISOString().slice(0, 10);
  await writeFile(path.join(DATA, "history", `${jstDate}.json`), json);

  if (out.status === "ok") {
    console.log(`ok：${out.blocks.length} ブロックを読んだ（${checkedAt}）`);
  } else {
    // 止まったことを、GitHub Actions の失敗として知らせる（表の 13）
    console.error(`stopped：${out.reason}`);
    process.exitCode = 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
