// 血液センターのページの HTML から、「献血状況」の12マスと日付の文字を取り出す。
// 決まった形でなければ、推測せずに ReadError で止める（セキュリティの表の 2・3）。
import { KINDS, LEVELS, TYPES } from "./blocks.mjs";

export class ReadError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const SECTION_OPEN = '<section class="center-main-today">';

// タグを取り除き、空白をまとめる。ここで取り出した文字は、画面では文字としてだけ使う（HTML にしない）
const plain = (s) => s.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

export function parseStatusPage(html) {
  if (typeof html !== "string" || html.length === 0) {
    throw new ReadError("empty", "ページが空っぽ");
  }

  const start = html.indexOf(SECTION_OPEN);
  if (start < 0) throw new ReadError("no-section", "「献血状況」の場所が見つからない");
  if (html.indexOf(SECTION_OPEN, start + 1) >= 0) {
    throw new ReadError("two-sections", "「献血状況」の場所が2つある");
  }
  const end = html.indexOf("</section>", start);
  if (end < 0) throw new ReadError("no-section-end", "「献血状況」の終わりが見つからない");
  const section = html.slice(start, end);

  // 日付の文字。ないブロックもある（近畿）ので、なければ null
  const dateMatch = section.match(/<p class="center-main-today-timedate">([\s\S]*?)<\/p>/);
  const dateText = dateMatch ? plain(dateMatch[1]) : null;

  // 種類のタブ：400mL、200mL、成分献血 の順でなければ止める
  const tabs = [...section.matchAll(/<li class="[^"]*\bmod-tabBtns-item\b[^"]*">([\s\S]*?)<\/li>/g)].map((m) => plain(m[1]));
  const expectedTabs = KINDS.map((k) => k.label);
  if (tabs.length !== expectedTabs.length || tabs.some((t, i) => t !== expectedTabs[i])) {
    throw new ReadError("tabs", `種類のタブが決まった形ではない：${JSON.stringify(tabs)}`);
  }

  // 種類ごとの並び。3つでなければ止める
  const lists = section.split(/<ul class="center-main-today-types\b/).slice(1);
  if (lists.length !== KINDS.length) {
    throw new ReadError("lists", `種類ごとの並びが ${lists.length} 個（3個のはず）`);
  }

  const values = {};
  lists.forEach((list, k) => {
    const items = list.split('<li class="center-main-today-types-item">').slice(1);
    if (items.length !== TYPES.length) {
      throw new ReadError("items", `${KINDS[k].label} のマスが ${items.length} 個（4個のはず）`);
    }
    values[KINDS[k].id] = items.map((item, t) => {
      const name = item.match(/<span>(A|O|B|AB)<\/span>\s*型/);
      if (!name || name[1] !== TYPES[t]) {
        throw new ReadError("type-order", `${KINDS[k].label} の ${t + 1} 番目が ${TYPES[t]}型 ではない`);
      }
      const icon = item.match(/ico_bloodHeart_([^_."/]+)_(rd|pk|yw)\.svg/);
      if (!icon) throw new ReadError("no-icon", `${KINDS[k].label} の ${TYPES[t]}型 に絵がない`);
      // 決まった4つの番号のどれかと、文字として完全に同じでなければ止める（"075" や "25.0" も止める）
      const level = LEVELS.find((l) => String(l.v) === icon[1]);
      if (!level) {
        throw new ReadError("unknown-level", `${KINDS[k].label} の ${TYPES[t]}型 の番号が決まった値ではない：${icon[1]}`);
      }
      const state = item.match(/<p class="center-main-today-types-state">([\s\S]*?)<\/p>/);
      if (!state || plain(state[1]) !== level.label) {
        throw new ReadError("label-mismatch", `${KINDS[k].label} の ${TYPES[t]}型 の言葉が絵の番号と合わない`);
      }
      return level.v;
    });
  });

  return { dateText, values };
}
