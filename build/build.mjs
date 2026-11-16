// 配るファイルを dist/ にまとめる（④ 配る の前）。
// 使い方：node build/build.mjs
//
// - site/ をそのまま写し、data/latest.json から data.json を作る
// - data.json を作る前に、もう一度形を確かめる。合わなければ「止まった」として出す（古い値も新しい値も出さない）
// - 読み取りの理由（reason）は公開しない。公開するのは status・checkedAt・blocks だけ
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkShape } from "../reader/validate.mjs";
import { PREFS, headExtra, prefLinks, prefPage, robotsTxt, sitemapXml, tableRows } from "./pages.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");

export function publicData(latest) {
  const checkedAt = typeof latest?.checkedAt === "string" ? latest.checkedAt : null;
  if (latest?.status === "ok" && checkShape(latest).length === 0) {
    return { status: "ok", checkedAt, blocks: latest.blocks.map(({ id, dateText, values }) => ({ id, dateText, values })) };
  }
  return { status: "stopped", checkedAt };
}

// 確かめ用：node build/build.mjs --test <データのファイル>
//   dist-test/ に作る（dist/ ではないので、配られることはない）。
//   データの確かめをわざと飛ばして、そのまま画面に渡す。画面の側でも守れているか（表の 2・4）を見るため。
async function main() {
  const testIndex = process.argv.indexOf("--test");
  const testFile = testIndex > 0 ? process.argv[testIndex + 1] : null;
  const out = testFile ? path.join(ROOT, "dist-test") : DIST;

  let data;
  if (testFile) {
    data = JSON.parse(await readFile(path.resolve(ROOT, testFile), "utf8"));
  } else {
    let latest = null;
    try {
      latest = JSON.parse(await readFile(path.join(ROOT, "data", "latest.json"), "utf8"));
    } catch {
      latest = null;
    }
    data = publicData(latest);
  }

  const config = JSON.parse(await readFile(path.join(ROOT, "site.config.json"), "utf8"));
  if (config.siteUrl && !/^https:\/\/[a-z0-9-]+\.pages\.dev\/?$/.test(config.siteUrl)) {
    throw new Error("site.config.json の siteUrl は https://〇〇.pages.dev/ の形にする");
  }

  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  await cp(path.join(ROOT, "site"), out, { recursive: true });
  await writeFile(path.join(out, "data.json"), JSON.stringify(data));

  // トップページ：検索の設定、JavaScript なしでも読める表、都道府県の一覧を書き込む
  const index = (await readFile(path.join(ROOT, "site", "index.html"), "utf8"))
    .replace("<!--HEAD_EXTRA-->", headExtra(config, "/"))
    .replace("<!--TABLE_ROWS-->", tableRows(data))
    .replace("<!--PREF_LINKS-->", prefLinks(""));
  await writeFile(path.join(out, "index.html"), index);

  // 都道府県ごとのページ
  for (const pref of PREFS) {
    await mkdir(path.join(out, pref.slug), { recursive: true });
    await writeFile(path.join(out, pref.slug, "index.html"), prefPage(pref, data, config));
  }

  await writeFile(path.join(out, "robots.txt"), robotsTxt(config));
  const sitemap = sitemapXml(config, data.checkedAt);
  if (sitemap) await writeFile(path.join(out, "sitemap.xml"), sitemap);

  console.log(`${path.basename(out)}/ を作った（data.json：${data.status}、都道府県のページ ${PREFS.length}${sitemap ? "、sitemap あり" : "、sitemap なし（siteUrl が未定）"}${testFile ? `、確かめ用：${testFile}` : ""}）`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
