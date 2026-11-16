// 画面の動き。見た目と動きは案6（idea-box/experiments/730-blood-map/6-gentle.html）と同じ。
//
// セキュリティの決まり（idea-box/ideas/730-security-checklist.md）：
// - 読み取った文字（日付）は textContent だけで入れる。innerHTML は使わない（表の 4）
// - data.json の値は、ここでも決まった4つの値かを確かめる。合わなければ止める（表の 2・3）
// - 外の住所には何も取りに行かない（表の 6）
(function () {
  "use strict";

  const TYPES = ["A", "O", "B", "AB"];
  const KINDS = [
    { id: "400", label: "400", unit: "mL" },
    { id: "200", label: "200", unit: "mL" },
    { id: "plasma", label: "成分献血", unit: "" },
  ];
  // 血液センターの表示の言葉とメッセージ（日本赤十字社の文。カードの中だけに出す）
  const LEVELS = {
    0: { label: "非常に困ってます", note: "至急ご協力をお願いします。お一人でも多くの方からの献血を必要としています。" },
    25: { label: "困っています", note: "患者さんに届けるために必要な血液量の確保が困難な状況です。ぜひ近日中のご協力をお願いします。" },
    50: { label: "心配です", note: "患者さんに届けるために必要な血液量の確保が今後心配な状況です。ご協力をお願いします。" },
    100: { label: "安心です", note: "患者さんに届けるために必要な血液量の確保ができています。" },
  };
  // 地図・表では強さの差を見せず、2つにまとめる（このページでの呼び方）
  const ASK = { on: { cls: "ask", word: "献血のお願いあり" }, off: { cls: "ok", word: "確保できている" } };
  const askOf = (v) => (v === 100 ? ASK.off : ASK.on);

  const BLOCKS = [
    { id: "hkd", name: "北海道", center: "hokkaido" },
    { id: "th", name: "東北", center: "miyagi" },
    { id: "ktks", name: "関東甲信越", center: "tokyo" },
    { id: "tkhr", name: "東海北陸", center: "aichi" },
    { id: "kk", name: "近畿", center: "osaka" },
    { id: "csk", name: "中四国", center: "hiroshima" },
    { id: "bc9", name: "九州", center: "fukuoka" },
  ];
  // 都道府県（JIS の番号順）と、ブロック、センターのページの名前
  const PREFS = [
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
  ].map(([name, block, center], i) => ({ name, block, center, code: String(i + 1).padStart(2, "0") }));
  const prefByName = new Map(PREFS.map((p) => [p.name, p]));
  const prefByCode = new Map(PREFS.map((p) => [p.code, p]));

  // 地域の札の場所（地図の 1000 x 1017 の中の座標）と、指す先
  const CHIPS = { hkd: [640, 86], th: [832, 410], ktks: [832, 664], tkhr: [770, 812], kk: [592, 912], csk: [230, 572], bc9: [285, 962] };
  const LEADS = { th: [700, 440], ktks: [660, 640], tkhr: [520, 735], kk: [410, 790], csk: [235, 700], bc9: [150, 900] };

  const centerUrl = (blockId, center) => `https://www.bs.jrc.or.jp/${blockId}/${center}/`;

  // ---- 部品を作る小さな道具（文字はいつも textContent で入れる） ----
  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue;
      node.setAttribute(k, String(v));
    }
    for (const c of children) {
      if (c === null || c === undefined || c === false) continue;
      node.append(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return node;
  }
  const SVG = "http://www.w3.org/2000/svg";
  function svg(tag, attrs) {
    const node = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs || {})) node.setAttribute(k, String(v));
    return node;
  }
  const $ = (id) => document.getElementById(id);

  // ---- data.json を確かめる（ここでも、決まった形でなければ止める） ----
  function checkData(data) {
    if (!data || data.status !== "ok" || !Array.isArray(data.blocks) || data.blocks.length !== BLOCKS.length) return null;
    const byId = {};
    for (let i = 0; i < BLOCKS.length; i++) {
      const b = data.blocks[i];
      if (!b || b.id !== BLOCKS[i].id || !b.values) return null;
      for (const k of KINDS) {
        const row = b.values[k.id];
        if (!Array.isArray(row) || row.length !== 4 || !row.every((v) => Object.prototype.hasOwnProperty.call(LEVELS, String(v)) && Number.isInteger(v))) return null;
      }
      // 日付の文字は、文字としてだけ出す。長すぎるものは出さない
      const dateText = typeof b.dateText === "string" && b.dateText.length <= 40 ? b.dateText : null;
      byId[b.id] = { values: b.values, dateText };
    }
    return byId;
  }

  // 読み取った時刻を日本の時刻で。地図の右下は短く（日付だけ）、「元のページ」には時まで
  function formatCheckedAt(iso) {
    const t = Date.parse(iso);
    if (Number.isNaN(t)) return null;
    const d = new Date(t + 9 * 3600 * 1000);
    const date = `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
    return { date, dateTime: `${date} ${d.getUTCHours()}時` };
  }

  // ---- 画面を組み立てる ----
  const state = { type: "A", kind: "400", block: null, pref: null };
  let DATA = null; // 確かめたあとの値。止まっているときは null

  function buildStatic(checkedAtText) {
    $("types").append(...TYPES.map((t) => el("button", { class: "type", type: "button", "data-type": t }, t, el("small", {}, "型"))));
    $("kinds").append(...KINDS.map((k) => el("button", { class: "kind", type: "button", "data-kind": k.id }, k.label, k.unit ? el("small", {}, k.unit) : null)));

    // 地図
    const M = window.JP_MAP;
    const root = svg("svg", { class: "jp", viewBox: `0 0 ${M.w} ${M.h}`, role: "img", "aria-label": "血液型ごとの献血のお願いの地図" });
    root.append(svg("rect", { class: "jp-inset", x: M.inset.x, y: M.inset.y, width: M.inset.w, height: M.inset.h, rx: 10 }));
    const gBlocks = svg("g", { class: "jp-blocks" });
    for (const b of BLOCKS) gBlocks.append(svg("path", { class: "jp-block", "data-block": b.id, d: M.blocks[b.id] }));
    const gPrefs = svg("g", { class: "jp-prefs" });
    for (const [code, d] of Object.entries(M.prefs)) gPrefs.append(svg("path", { "data-code": code, d }));
    const gLead = svg("g", { class: "jp-lead" });
    for (const [id, [x, y]] of Object.entries(LEADS)) {
      gLead.append(svg("line", { x1: CHIPS[id][0], y1: CHIPS[id][1], x2: x, y2: y }), svg("circle", { cx: x, cy: y, r: 6 }));
    }
    root.append(gBlocks, gPrefs, gLead);
    const map = $("map");
    map.append(root);
    const inset = el("span", { class: "inset-name" }, "奄美・沖縄");
    inset.style.left = `${(M.inset.x + 10) / 10}%`;
    inset.style.top = `${((M.inset.y + 6) / M.h) * 100}%`;
    map.append(inset);
    for (const b of BLOCKS) {
      const chip = el("button", { class: "chip", type: "button", "data-block": b.id }, el("b", {}, b.name), el("span", {}, el("i", { class: "sw" }), el("em", {})));
      chip.style.left = `${CHIPS[b.id][0] / 10}%`;
      chip.style.top = `${(CHIPS[b.id][1] / M.h) * 100}%`;
      map.append(chip);
    }
    map.append(el("span", { class: "stamp" }, "非公式のまとめ", checkedAtText ? el("span", { class: "yr" }, `・${checkedAtText.date}に読み取り`) : null));

    $("legend").append(...[ASK.on, ASK.off].map((a) => el("li", {}, el("i", { class: `sw ${a.cls}` }), a.word)));

    const select = $("pref");
    select.append(el("option", { value: "" }, "選んでください"));
    for (const b of BLOCKS) {
      const group = el("optgroup", { label: b.name });
      for (const p of PREFS.filter((p) => p.block === b.id)) group.append(el("option", { value: p.name }, p.name));
      select.append(group);
    }

    $("sources").append(
      ...BLOCKS.map((b) =>
        el("li", {}, el("span", {}, el("b", {}, b.name), el("small", {}, DATA ? DATA[b.id].dateText || "ページに日付の記載なし" : "—")), el("a", { href: centerUrl(b.id, b.center), rel: "noopener" }, "元のページ")),
      ),
    );
    if (checkedAtText) $("readAt").textContent = `赤十字血液センターのウェブサイトです。このページの値は、${checkedAtText.dateTime}に読み取りました。`;

    $("thead").append(el("th", {}, "地域"), ...TYPES.map((t) => el("th", {}, `${t}型`)));
  }

  const levelOf = (blockId, kind, type) => DATA[blockId].values[kind][TYPES.indexOf(type)];

  function draw() {
    document.querySelectorAll(".type").forEach((n) => n.setAttribute("aria-pressed", String(n.dataset.type === state.type)));
    document.querySelectorAll(".kind").forEach((n) => n.setAttribute("aria-pressed", String(n.dataset.kind === state.kind)));
    document.querySelectorAll(".jp-block").forEach((n) => {
      const a = DATA ? askOf(levelOf(n.dataset.block, state.kind, state.type)) : null;
      n.classList.toggle("ask", a === ASK.on);
      n.classList.toggle("ok", a === ASK.off);
      n.dataset.on = String(n.dataset.block === state.block);
    });
    document.querySelectorAll(".chip").forEach((n) => {
      const a = DATA ? askOf(levelOf(n.dataset.block, state.kind, state.type)) : null;
      const sw = n.querySelector("i");
      sw.classList.toggle("ask", a === ASK.on);
      sw.classList.toggle("ok", a === ASK.off);
      n.querySelector("em").textContent = a ? a.word : "表示を止めています";
      n.setAttribute("aria-pressed", String(n.dataset.block === state.block));
    });
    const selected = state.pref ? prefByName.get(state.pref) : null;
    document.querySelectorAll(".jp-prefs path").forEach((n) => {
      const on = selected !== null && n.dataset.code === selected.code;
      n.dataset.on = String(on);
      if (on) n.parentNode.appendChild(n); // 太い線が隣の県の下に隠れないように、一番上に置く
    });
    $("pref").value = state.pref || "";

    const tbody = $("tbody");
    tbody.replaceChildren(
      ...BLOCKS.map((b) => el("tr", {}, el("th", {}, b.name), ...TYPES.map((t) => el("td", {}, DATA ? askOf(levelOf(b.id, state.kind, t)).word : "—")))),
    );

    drawCard(selected);
  }

  function drawCard(selected) {
    const card = $("card");
    const block = BLOCKS.find((b) => b.id === state.block);
    if (!block) {
      card.replaceChildren(el("p", { class: "empty" }, "都道府県を選ぶか、地図や地域名を押すと、その地域の血液センターの表示がここに出ます。"));
      return;
    }
    const url = selected ? centerUrl(block.id, selected.center) : centerUrl(block.id, block.center);
    const title = selected ? el("h2", {}, selected.name, el("small", {}, `${block.name}ブロック`)) : el("h2", {}, block.name);
    const link = el("a", { href: url, rel: "noopener" }, "元のページを見る（血液センターのウェブサイト）");

    if (!DATA) {
      card.replaceChildren(title, el("p", { class: "empty" }, "今日は表示を止めています。最新の情報は、元のページでご確認ください。"), el("p", { class: "src" }, link));
      return;
    }
    // カードの中だけは、血液センターの表示の言葉をそのまま出す
    const rows = el(
      "div",
      { class: "rows" },
      ...TYPES.map((t) => {
        const v = levelOf(block.id, state.kind, t);
        return el("div", { class: t === state.type ? "row on" : "row" }, el("span", { class: "t" }, `${t}型`), el("i", { class: `sw ${askOf(v).cls}` }), el("span", { class: "w" }, LEVELS[v].label));
      }),
    );
    const sel = LEVELS[levelOf(block.id, state.kind, state.type)];
    card.replaceChildren(
      title,
      el("p", { class: "label" }, "献血する方へのお願いの言葉です（血液センターの表示のまま）"),
      rows,
      el("p", { class: "msg" }, el("b", {}, `${state.type}型へのメッセージ`), sel.note),
      selected ? el("p", { class: "shared" }, `この表示は${block.name}ブロックで共通です。`) : null,
      el("p", { class: "src" }, `ブロックの日付：${DATA[block.id].dateText || "ページに日付の記載なし"}`, el("br"), link),
    );
  }

  function listen() {
    document.addEventListener("click", (e) => {
      const t = e.target.closest("[data-type]");
      const k = e.target.closest("[data-kind]");
      const c = e.target.closest("[data-code]");
      const b = e.target.closest("[data-block]");
      if (t) state.type = t.dataset.type;
      else if (k) state.kind = k.dataset.kind;
      else if (c && prefByCode.has(c.dataset.code)) {
        const p = prefByCode.get(c.dataset.code);
        state.pref = p.name;
        state.block = p.block;
      } else if (b) {
        state.block = b.dataset.block;
        state.pref = null;
      } else return;
      draw();
    });
    $("pref").addEventListener("change", (e) => {
      const p = prefByName.get(e.target.value);
      state.pref = p ? p.name : null;
      if (p) state.block = p.block;
      draw();
    });
  }

  // 都道府県のページの「全国の地図で見る」から来たときは、その都道府県を選んだ状態で開く。
  // 住所の ?pref= は、決まった47の名前と完全に同じときだけ使う
  function readPrefFromUrl() {
    const p = prefByName.get(new URLSearchParams(location.search).get("pref") || "");
    if (p) {
      state.pref = p.name;
      state.block = p.block;
    }
  }

  async function start() {
    readPrefFromUrl();
    let data = null;
    try {
      const res = await fetch("data.json", { cache: "no-cache" });
      if (res.ok) data = await res.json();
    } catch {
      data = null;
    }
    DATA = checkData(data);
    if (!DATA) $("stopped").hidden = false;
    buildStatic(DATA ? formatCheckedAt(data.checkedAt) : null);
    listen();
    draw();
  }

  start();
})();
