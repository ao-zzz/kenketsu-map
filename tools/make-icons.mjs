// アイコンの PNG を作る（一度だけ。site/ に置いてリポジトリに入れる）。
// 使い方：node tools/make-icons.mjs <playwright の index.mjs>
//   site/favicon.svg        → site/favicon-48.png（検索結果やタブ向け。Google は 48 の倍数をすすめている）
//   tools/icon-touch.svg    → site/apple-touch-icon.png（iPhone のホーム画面。ふちなし。角は iPhone が丸める）
// playwright はこのリポジトリの部品にしない（手元の確かめ用のものを使う）
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pw = process.argv[2];
if (!pw) throw new Error("playwright の index.mjs の場所を渡す");
const { chromium } = await import(pathToFileURL(pw).href);

const jobs = [
  ["site/favicon.svg", "site/favicon-48.png", 48],
  ["tools/icon-touch.svg", "site/apple-touch-icon.png", 180],
];
const b = await chromium.launch({ channel: "msedge" }); // Windows の Edge で描く
for (const [src, out, size] of jobs) {
  const svg = readFileSync(path.join(ROOT, src), "utf8");
  const p = await b.newPage({ viewport: { width: size, height: size } });
  await p.setContent(`<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
  await p.screenshot({ path: path.join(ROOT, out), omitBackground: true });
  await p.close();
  console.log(`${out}（${size}px）`);
}
await b.close();
