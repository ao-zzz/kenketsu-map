// フォントを一度だけ取ってきて、site/fonts/ に置く。公開したページは、外のフォントの住所を読まない（セキュリティの表の 6）。
// 使い方：node tools/fetch-fonts.mjs
//
// - 見た目は案6 と同じ「しっぽり明朝 B1（800）」と「Zen 角ゴシック New（500・700・900）」。どちらも SIL Open Font License で、自分で配ってよい
// - Google Fonts は、文字の範囲ごとに小さく分けたファイルを配っている。そのうち、このページで使う文字を含むものだけを持ってくる
//   （ページの文を変えたら、もう一度動かす。持ってこなかった範囲の文字は、端末の文字で出る）
// - 外の部品は使わない（Node の標準の fetch だけ）
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "site", "fonts");
const CSS_URL = "https://fonts.googleapis.com/css2?family=Shippori+Mincho+B1:wght@800&family=Zen+Kaku+Gothic+New:wght@500;700;900&display=swap";
// woff2 と文字の範囲つきの CSS を返してもらうため、ふつうのブラウザの名前を名のる
const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const LICENSES = [
  ["Shippori Mincho B1", "https://raw.githubusercontent.com/google/fonts/main/ofl/shipporiminchob1/OFL.txt"],
  ["Zen Kaku Gothic New", "https://raw.githubusercontent.com/google/fonts/main/ofl/zenkakugothicnew/OFL.txt"],
];
// ページの文のほかに、読み取った日付に出てきうる文字
const EXTRA = "0123456789０１２３４５６７８９年月日時分現在更新状況のから～〜~/()（）:：-・.令和点北海道—";

async function get(url, as = "text") {
  const res = await fetch(url, { headers: { "user-agent": BROWSER_UA }, redirect: "error", signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`${url}：HTTP ${res.status}`);
  return as === "text" ? res.text() : Buffer.from(await res.arrayBuffer());
}

// "U+0-FF, U+131, U+152-153" → [[0,255],[305,305],[338,339]]
function parseRanges(text) {
  return text.split(",").map((part) => {
    const [a, b] = part.trim().replace(/^U\+/i, "").split("-");
    return [parseInt(a, 16), parseInt(b ?? a, 16)];
  });
}

async function usedCodepoints() {
  const files = [path.join(ROOT, "site", "index.html"), path.join(ROOT, "site", "app.js"), path.join(ROOT, "build", "pages.mjs")];
  const text = (await Promise.all(files.map((f) => readFile(f, "utf8")))).join("") + EXTRA;
  return new Set([...text].map((ch) => ch.codePointAt(0)));
}

async function main() {
  const css = await get(CSS_URL);
  const faces = [...css.matchAll(/@font-face\s*{([^}]*)}/g)].map((m) => {
    const body = m[1];
    const family = body.match(/font-family:\s*'([^']+)'/)[1];
    const weight = body.match(/font-weight:\s*(\d+)/)[1];
    const url = body.match(/src:\s*url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/)?.[1];
    const range = body.match(/unicode-range:\s*([^;]+);/)?.[1];
    if (!url || !range) throw new Error("思っていた形の CSS ではない");
    return { family, weight, url, range };
  });

  const used = await usedCodepoints();
  const keep = faces.filter((f) => parseRanges(f.range).some(([a, b]) => [...used].some((cp) => cp >= a && cp <= b)));

  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  const rules = [];
  let total = 0;
  for (const [i, f] of keep.entries()) {
    const name = `${f.family.toLowerCase().replace(/\s+/g, "-")}-${f.weight}-${String(i).padStart(3, "0")}.woff2`;
    const data = await get(f.url, "buffer");
    if (data.length > 2_000_000) throw new Error(`${name} が大きすぎる`);
    total += data.length;
    await writeFile(path.join(OUT, name), data);
    rules.push(`@font-face{font-family:'${f.family}';font-style:normal;font-weight:${f.weight};font-display:swap;src:url(./${name}) format('woff2');unicode-range:${f.range};}`);
  }
  await writeFile(
    path.join(OUT, "fonts.css"),
    `/* tools/fetch-fonts.mjs で作った。手で直さない。Google Fonts の ${faces.length} 個のうち、このページで使う文字を含む ${keep.length} 個だけ */\n${rules.join("\n")}\n`,
  );

  const licenses = [];
  for (const [family, url] of LICENSES) licenses.push(`==== ${family} ====\n\n${await get(url)}`);
  await writeFile(path.join(OUT, "OFL.txt"), licenses.join("\n\n"));

  console.log(`${keep.length} / ${faces.length} 個のファイル、合計 ${(total / 1024).toFixed(0)} KB を site/fonts/ に置いた`);
}

await main();
