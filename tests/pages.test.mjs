// 都道府県のページと、検索の機械への案内のテスト。表の 4（HTML として出さない）と、止まったときの表示。
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { BLOCKS } from "../reader/blocks.mjs";
import { PREFS, checkOwner, esc, notFoundPage, ownerHtml, prefPage, robotsTxt, securityTxt, sitemapXml, tableRows } from "../build/pages.mjs";

const FORM = "https://docs.google.com/forms/d/e/1FAIpQLSexample_-123/viewform";
const config = { siteUrl: "https://example.pages.dev/", indexable: true, operator: "ao-zzz", contactUrl: FORM };
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
    assert.match(prefPage(tokyo, data(), { ...config, siteUrl: "", indexable: false }), /<meta name="robots" content="noindex">/);
  });

  test("リンクカードの画像（1200×630の固定の画像）と大きいカードの指定が入る。二重にならない", () => {
    const html = prefPage(tokyo, data(), config);
    assert.match(html, /<meta property="og:image" content="https:\/\/example\.pages\.dev\/ogp\.png">/);
    assert.match(html, /<meta property="og:image:width" content="1200">/);
    assert.match(html, /<meta property="og:image:height" content="630">/);
    assert.equal(html.match(/name="twitter:card"/g).length, 1);
    assert.match(html, /<meta name="twitter:card" content="summary_large_image">/);
  });

  test("運営者の名前とお問い合わせのフォームが、どの都道府県のページにも出る", () => {
    const html = prefPage(tokyo, data(), config);
    assert.match(html, /運営者：ao-zzz（個人）/);
    assert.ok(html.includes(`<a href="${FORM}" rel="noopener noreferrer">`));
  });
});

describe("運営者と連絡先", () => {
  test("Google フォーム以外の住所は、作る前に止める（javascript: や よそのサイト）", () => {
    for (const bad of ["javascript:alert(1)", "http://forms.gle/abc", "https://evil.example/forms/d/e/x/viewform", "https://forms.gle/abc\"onclick=x", "https://docs.google.com/forms/d/e/x/viewform?x=<script>"]) {
      assert.throws(() => checkOwner({ operator: "ao-zzz", contactUrl: bad }), /contactUrl/, bad);
    }
    assert.doesNotThrow(() => checkOwner({ operator: "ao-zzz", contactUrl: FORM }));
    assert.doesNotThrow(() => checkOwner({ operator: "ao-zzz", contactUrl: "https://forms.gle/AbC123" }));
  });
  test("運営者の名前に HTML の文字が入っていたら、作る前に止める", () => {
    assert.throws(() => checkOwner({ operator: "<b>x</b>" }), /operator/);
    assert.throws(() => checkOwner({}), /operator/);
  });
  test("連絡先が決まっていないときは「準備中」と出し、security.txt は作らない", () => {
    assert.match(ownerHtml({ operator: "ao-zzz", contactUrl: "" }), /連絡先は準備中です/);
    assert.equal(securityTxt({ ...config, contactUrl: "" }), null);
  });
  test("security.txt に連絡先と1年後の期限が入る", () => {
    const txt = securityTxt(config, new Date("2026-11-17T00:00:00Z"));
    assert.match(txt, new RegExp(`^Contact: ${FORM.replace(/[.?/]/g, "\\$&")}$`, "m"));
    assert.match(txt, /^Expires: 2027-11-17T00:00:00Z$/m);
    assert.match(txt, /^Canonical: https:\/\/example\.pages\.dev\/\.well-known\/security\.txt$/m);
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
  test("見つからない住所のページは、検索に載せず、スクリプトもない", () => {
    const html = notFoundPage(config);
    assert.match(html, /<meta name="robots" content="noindex">/);
    assert.equal(/<script/i.test(html), false);
    assert.equal(/仮の名前/.test(html + prefPage(tokyo, data(), config)), false);
  });
  test("都道府県のページと見つからない住所のページにアイコンがある", () => {
    for (const html of [prefPage(tokyo, data(), config), notFoundPage(config)]) {
      assert.match(html, /<link rel="icon" href="\/favicon\.svg"/);
      assert.match(html, /<link rel="apple-touch-icon" href="\/apple-touch-icon\.png">/);
    }
  });
  test("esc は HTML の特別な文字を全部かえる", () => {
    assert.equal(esc(`<a href="x" onclick='y'>&</a>`), "&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;");
  });
});
