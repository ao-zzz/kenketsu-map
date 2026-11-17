// 配る前に、HTML を作る部分（都道府県ごとのページ、トップページの表と都道府県の一覧、sitemap.xml、robots.txt）。
// JavaScript がなくても読める形にして、検索の機械にも中身が伝わるようにする。
//
// セキュリティ（表の 4）：HTML に入れる文字は、すべて esc() を通す。読み取った日付の文字も、HTML として出さない。
import { BLOCKS, KINDS, LEVELS, TYPES } from "../reader/blocks.mjs";

// 都道府県（JIS の番号順）。slug は住所（/tokyo/ など）で、血液センターのページの名前と同じ
export const PREFS = [
  ["北海道", "hkd", "hokkaido"], ["青森", "th", "aomori"], ["岩手", "th", "iwate"], ["宮城", "th", "miyagi"], ["秋田", "th", "akita"],
  ["山形", "th", "yamagata"], ["福島", "th", "fukushima"], ["茨城", "ktks", "ibaraki"], ["栃木", "ktks", "tochigi"], ["群馬", "ktks", "gunma"],
  ["埼玉", "ktks", "saitama"], ["千葉", "ktks", "chiba"], ["東京", "ktks", "tokyo"], ["神奈川", "ktks", "kanagawa"], ["新潟", "ktks", "niigata"],
  ["富山", "tkhr", "toyama"], ["石川", "tkhr", "ishikawa"], ["福井", "tkhr", "fukui"], ["山梨", "ktks", "yamanashi"], ["長野", "ktks", "nagano"],
  ["岐阜", "tkhr", "gifu"], ["静岡", "tkhr", "shizuoka"], ["愛知", "tkhr", "aichi"], ["三重", "tkhr", "mie"], ["滋賀", "kk", "shiga"],
  ["京都", "kk", "kyoto"], ["大阪", "kk", "osaka"], ["兵庫", "kk", "hyogo"], ["奈良", "kk", "nara"], ["和歌山", "kk", "wakayama"],
  ["鳥取", "csk", "tottori"], ["島根", "csk", "shimane"], ["岡山", "csk", "okayama"], ["広島", "csk", "hiroshima"], ["山口", "csk", "yamaguchi"],
  ["徳島", "csk", "tokushima"], ["香川", "csk", "kagawa"], ["愛媛", "csk", "ehime"], ["高知", "csk", "kochi"], ["福岡", "bc9", "fukuoka"],
  ["佐賀", "bc9", "saga"], ["長崎", "bc9", "nagasaki"], ["熊本", "bc9", "kumamoto"], ["大分", "bc9", "oita"], ["宮崎", "bc9", "miyazaki"],
  ["鹿児島", "bc9", "kagoshima"], ["沖縄", "bc9", "okinawa"],
].map(([name, block, slug]) => ({
  name,
  full: name === "北海道" ? name : name === "東京" ? "東京都" : name === "大阪" || name === "京都" ? `${name}府` : `${name}県`,
  block,
  slug,
}));

// 血液センターの言葉の意味（日本赤十字社の文）
const NOTES = {
  0: "至急ご協力をお願いします。お一人でも多くの方からの献血を必要としています。",
  25: "患者さんに届けるために必要な血液量の確保が困難な状況です。ぜひ近日中のご協力をお願いします。",
  50: "患者さんに届けるために必要な血液量の確保が今後心配な状況です。ご協力をお願いします。",
  100: "患者さんに届けるために必要な血液量の確保ができています。",
};
const KIND_TITLE = { 400: "400mL 献血", 200: "200mL 献血", plasma: "成分献血" };
const labelOf = (v) => LEVELS.find((l) => l.v === v).label;
const askWord = (v) => (v === 100 ? "確保できている" : "献血のお願いあり");
const askCls = (v) => (v === 100 ? "ok" : "ask");
const centerUrl = (blockId, slug) => `https://www.bs.jrc.or.jp/${blockId}/${slug}/`;

// アイコン（どの深さのページでも同じなので、住所は / から書く）
export const ICON_LINKS = `<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-48.png" sizes="48x48" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">`;

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

export function formatCheckedAt(iso) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const d = new Date(t + 9 * 3600 * 1000);
  return `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日 ${d.getUTCHours()}時`;
}

const blockOf = (data, id) => (data.status === "ok" ? data.blocks.find((b) => b.id === id) : null);

// ---- トップページに書き込む部分 ----

export function tableRows(data, kind = "400") {
  return BLOCKS.map((b) => {
    const blk = blockOf(data, b.id);
    const cells = TYPES.map((t, i) => `<td>${esc(blk ? askWord(blk.values[kind][i]) : "—")}</td>`).join("");
    return `<tr><th>${esc(b.name)}</th>${cells}</tr>`;
  }).join("");
}

export function prefLinks(prefix = "") {
  return PREFS.map((p) => `<li><a href="${esc(prefix + p.slug)}/">${esc(p.full)}</a></li>`).join("");
}

export function headExtra(config, pathName) {
  const parts = [];
  if (!config.indexable) parts.push('<meta name="robots" content="noindex">');
  if (config.siteUrl) parts.push(`<link rel="canonical" href="${esc(config.siteUrl.replace(/\/$/, "") + pathName)}">`);
  return parts.join("\n");
}

// ---- 運営者と連絡先 ----
// 連絡先は Google フォームのリンクだけを許す（ページに埋め込まず、リンクにするだけ。CSP は変えない）。

const CONTACT_URL = /^https:\/\/(docs\.google\.com\/forms\/d\/e\/[A-Za-z0-9_-]+\/viewform|forms\.gle\/[A-Za-z0-9]+)$/;

export function checkOwner(config) {
  if (typeof config.operator !== "string" || !/^[A-Za-z0-9_-]{1,40}$/.test(config.operator)) {
    throw new Error("site.config.json の operator は英数字と - _ だけ（40文字まで）にする");
  }
  if (config.contactUrl && !CONTACT_URL.test(config.contactUrl)) {
    throw new Error("site.config.json の contactUrl は Google フォームの住所（https://docs.google.com/forms/d/e/…/viewform か https://forms.gle/…）にする");
  }
}

export function ownerHtml(config) {
  const contact = config.contactUrl
    ? `ご連絡（まちがいのお知らせ、直してほしい・消してほしいというお願い）は、<a href="${esc(config.contactUrl)}" rel="noopener noreferrer">お問い合わせのフォーム（Google フォーム）</a>からお送りください。`
    : "連絡先は準備中です。";
  return `運営者：${esc(config.operator)}（個人）。${contact}`;
}

// 守りの問題を見つけた人への連絡先（RFC 9116）。連絡先が決まったときだけ出す。
export function securityTxt(config, now = new Date()) {
  if (!config.contactUrl) return null;
  const expires = new Date(now.getTime() + 365 * 24 * 3600 * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
  const lines = [`Contact: ${config.contactUrl}`, `Expires: ${expires}`, "Preferred-Languages: ja"];
  if (config.siteUrl) lines.push(`Canonical: ${config.siteUrl.replace(/\/$/, "")}/.well-known/security.txt`);
  return lines.join("\n") + "\n";
}

// ---- 都道府県のページ ----

export function prefPage(pref, data, config) {
  const block = BLOCKS.find((b) => b.id === pref.block);
  const blk = blockOf(data, block.id);
  const readAt = data.status === "ok" ? formatCheckedAt(data.checkedAt) : null;
  const title = `${pref.full}の献血状況（血液型ごと）｜献血のお願いマップ（非公式）`;
  const desc = `${pref.full}の血液センター（${block.name}ブロック）が、いま何型の献血をお願いしているかを、血液型ごと・献血の種類ごとにまとめた非公式のページです。1日1回、元のページを読み取って更新しています。`;
  const url = centerUrl(block.id, pref.slug);

  let body;
  if (blk) {
    const seen = new Set();
    const cards = KINDS.map((k) => {
      const rows = TYPES.map((t, i) => {
        const v = blk.values[k.id][i];
        seen.add(v);
        return `<div class="row on"><span class="t">${esc(t)}型</span><i class="sw ${askCls(v)}"></i><span class="w">${esc(labelOf(v))}</span></div>`;
      }).join("");
      return `<section class="card"><h3>${esc(KIND_TITLE[k.id])}</h3><div class="rows">${rows}</div></section>`;
    }).join("");
    const notes = LEVELS.filter((l) => seen.has(l.v))
      .map((l) => `<li><b>${esc(l.label)}</b>${esc(NOTES[l.v])}</li>`)
      .join("");
    body = `
    <p class="label">献血する方へのお願いの言葉です（血液センターの表示のまま）</p>
    <div class="kind-cards">${cards}</div>
    <section class="block">
      <h2>それぞれの言葉の意味（血液センターの説明）</h2>
      <ul class="notes">${notes}</ul>
    </section>
    <p class="src">ブロックの日付：${esc(blk.dateText || "ページに日付の記載なし")}${readAt ? `<br>このページの値は、${esc(readAt)}に読み取りました。` : ""}<br><a href="${esc(url)}" rel="noopener">元のページを見る（${esc(pref.full)}の血液センターのウェブサイト）</a></p>`;
  } else {
    body = `
    <p class="stopped">今日は血液センターのページを読み取れなかったため、表示を止めています。最新の情報は、元のページでご確認ください。</p>
    <p class="src"><a href="${esc(url)}" rel="noopener">元のページを見る（${esc(pref.full)}の血液センターのウェブサイト）</a></p>`;
  }

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${headExtra(config, `/${pref.slug}/`)}
<meta name="theme-color" content="#3c2829">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta name="twitter:card" content="summary">
${ICON_LINKS}
<link rel="stylesheet" href="../fonts/fonts.css">
<link rel="stylesheet" href="../style.css">
</head>
<body>
<p class="notice">非公式のページです。日本赤十字社・各血液センターとは関係がありません。</p>
<div class="wrap one">
  <p class="crumb"><a href="../">献血のお願いマップ</a></p>
  <p class="patient"><b>輸血を受ける方・ご家族へ</b>この表示は、献血へのご協力をお願いするための血液センターからのメッセージで、在庫の数字ではありません。ご自身の輸血については、主治医にご相談ください。</p>
  <h1>${esc(pref.full)}の献血状況<small>血液型ごと・${esc(block.name)}ブロックで共通の表示</small></h1>
  <p class="note">${esc(pref.full)}の血液センターが出している「献血へのお願い」です。この表示は${esc(block.name)}ブロックで共通です。最新の情報は、元のページでご確認ください。</p>
  ${body}
  <p class="label can">あなたにできること</p>
  <a class="cta" href="https://www.kenketsu.jp/" rel="noopener"><b>献血の予約へ</b><small>ラブラッド（日本赤十字社の献血Web会員サービス）</small></a>
  <a class="cta2" href="https://www.jrc.or.jp/donation/about/terms/" rel="noopener">献血できる条件を確かめる（日本赤十字社ウェブサイト）</a>
  <a class="to-map" href="../?pref=${esc(encodeURIComponent(pref.name))}">全国の地図で見る</a>

  <section class="block">
    <h2>「血液が足りない」と聞いて調べた方へ</h2>
    <p class="prose">SNS などで「血液不足」と話題になることがあります。このページの表示は、血液センターが出している献血へのお願いのメッセージで、在庫の数字ではありません。輸血を受ける方は、主治医にご相談ください。</p>
  </section>

  <section class="block">
    <h2>都道府県から探す</h2>
    <ul class="pref-links">${prefLinks("../")}</ul>
  </section>

  <p class="fine">非公式のページです。日本赤十字社の公式のページではありません。「非常に困ってます」などの言葉と説明文の著作権は、日本赤十字社にあります。文字：しっぽり明朝 B1、Zen 角ゴシック New（SIL Open Font License。<a href="../fonts/OFL.txt">ライセンス</a>）。</p>
  <p class="owner">${ownerHtml(config)}</p>
</div>
</body>
</html>
`;
}

// ---- 見つからない住所 ----
// Pages は 404.html がないと、どんな住所にもトップを返す（検索の機械に同じページがたくさんあるように見える）。
// これを置くと、ない住所は 404 で返る。どの深さの住所でも出るので、住所は / から書く

export function notFoundPage(config) {
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#3c2829">
<title>ページが見つかりません｜献血のお願いマップ（非公式）</title>
${ICON_LINKS}
<link rel="stylesheet" href="/fonts/fonts.css">
<link rel="stylesheet" href="/style.css">
</head>
<body>
<p class="notice">非公式のページです。日本赤十字社・各血液センターとは関係がありません。</p>
<div class="wrap one">
  <p class="crumb"><a href="/">献血のお願いマップ</a></p>
  <h1>ページが見つかりません</h1>
  <p class="note">住所がまちがっているか、ページがなくなった可能性があります。</p>
  <a class="to-map" href="/">全国の地図で見る</a>
  <section class="block">
    <h2>都道府県から探す</h2>
    <ul class="pref-links">${prefLinks("/")}</ul>
  </section>
  <p class="owner">${ownerHtml(config)}</p>
</div>
</body>
</html>
`;
}

// ---- 検索の機械への案内 ----

export function robotsTxt(config) {
  const lines = ["User-agent: *", config.indexable ? "Allow: /" : "Disallow: /"];
  if (config.siteUrl && config.indexable) lines.push(`Sitemap: ${config.siteUrl.replace(/\/$/, "")}/sitemap.xml`);
  return lines.join("\n") + "\n";
}

export function sitemapXml(config, lastmod) {
  if (!config.siteUrl) return null;
  const base = config.siteUrl.replace(/\/$/, "");
  const urls = ["/", ...PREFS.map((p) => `/${p.slug}/`)];
  const day = lastmod ? `<lastmod>${esc(lastmod.slice(0, 10))}</lastmod>` : "";
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${esc(base + u)}</loc>${day}</url>`).join("\n")}\n</urlset>\n`;
}
