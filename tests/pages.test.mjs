// 都道府県のページと、検索の機械への案内のテスト。表の 4（HTML として出さない）と、止まったときの表示。
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { BLOCKS } from "../reader/blocks.mjs";
import { PREFS, esc, prefPage, robotsTxt, sitemapXml, tableRows } from "../build/pages.mjs";

const config = { siteUrl: "https://example.pages.dev/", indexable: true };
const data = (dateText = "2026/11/15") => ({
  status: "ok",
  checkedAt: "2026-11-14T22:00:00.000Z",
  blocks: BLOCKS.map((b) => ({ id: b.id, dateText, values: { 400: [0, 25, 50, 100], 200: [100, 100, 100, 100], plasma: [0, 0, 0, 0] } })),
});
const tokyo = PREFS.find((p) => p.slug === "tokyo");

describe("都道府県のページ", () => {
  test("47 都道府県あり、住所（slug）が重ならない", () => {
    assert.equal(PREFS.length, 47);
    assert.equal(new Set(PREFS.map((p) => p.slug)).size, 47);
  });

  test("東京都のページに、血液センターの言葉と元のページが出る", () => {
    const html = prefPage(tokyo, data(), config);
    assert.match(html, /<h1>東京都の献血状況/);
    assert.match(html, /非常に困ってます/);
    assert.match(html, /https:\/\/www\.bs\.jrc\.or\.jp\/ktks\/tokyo\//);
    assert.match(html, /<link rel="canonical" href="https:\/\/example\.pages\.dev\/tokyo\/">/);
  });

  test("表の 4：日付の文字に <script> があっても、HTML として出さない", () => {
    const html = prefPage(tokyo, data("<script>alert(1)</script>"), config);
    assert.equal(html.includes("<script>alert(1)</script>"), false);
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  });

  test("表の 4：ページ全体に <script> のタグが1つもない（都道府県のページは JavaScript を使わない）", () => {
    assert.equal(/<script/i.test(prefPage(tokyo, data(), config)), false);
  });

  test("止まったときは、値を出さずに元のページへ案内する", () => {
    const html = prefPage(tokyo, { status: "stopped", checkedAt: "x" }, config);
    assert.match(html, /表示を止めています/);
    assert.equal(html.includes("非常に困ってます</span>"), false);
  });

  test("検索に載せない設定のときは noindex が入る", () => {
    assert.match(prefPage(tokyo, data(), { siteUrl: "", indexable: false }), /<meta name="robots" content="noindex">/);
  });
});

describe("トップページの表と、検索の機械への案内", () => {
  test("表は、このページでの呼び方（2つ）だけで、強い言葉を出さない", () => {
    const rows = tableRows(data());
    assert.match(rows, /献血のお願いあり/);
    assert.equal(/非常に困ってます|困っています|心配です/.test(rows), false);
  });
  test("sitemap に 48 の住所（トップと47都道府県）が入る", () => {
    assert.equal(sitemapXml(config, "2026-11-15").match(/<loc>/g).length, 48);
  });
  test("住所が決まっていないときは sitemap を作らない", () => {
    assert.equal(sitemapXml({ siteUrl: "", indexable: true }), null);
  });
  test("robots.txt は、検索に載せるかの設定に従う", () => {
    assert.match(robotsTxt(config), /Allow: \//);
    assert.match(robotsTxt({ siteUrl: "", indexable: false }), /Disallow: \//);
  });
  test("esc は HTML の特別な文字を全部かえる", () => {
    assert.equal(esc(`<a href="x" onclick='y'>&</a>`), "&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;");
  });
});
