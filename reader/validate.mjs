// 読み取った全体を、出してよいかを確かめる。
// 形の確かめ（セキュリティの表の 2・3）、日付の文字の絞り込み（4）、不自然な変化（5）。
import { BLOCKS, KINDS, LEVEL_VALUES, TYPES } from "./blocks.mjs";

// 日付の文字は、決まった文字だけで、40文字以内のときだけ使う。
// 合わなければ null（画面では「ページに日付の記載なし」）。止めはしない。
// 全角の数字やかっこは、NFKC で半角にしてから文字の種類を確かめる（出すのは元の文字）。
const DATE_CHARS = /^[0-9年月日時分現在更新状況のから~\/()（）:\-・.令和点 北海道]+$/u;

export function cleanDateText(raw) {
  if (typeof raw !== "string") return null;
  const text = raw.replace(/\s+/g, " ").trim();
  if (text.length === 0 || text.length > 40) return null;
  if (!DATE_CHARS.test(text.normalize("NFKC"))) return null;
  return text;
}

// 形の確かめ。合わない理由を全部返す（空なら合格）
export function checkShape(snapshot) {
  const reasons = [];
  const blocks = snapshot?.blocks;
  if (!Array.isArray(blocks) || blocks.length !== BLOCKS.length) {
    return [`ブロックの数が ${Array.isArray(blocks) ? blocks.length : "なし"}（${BLOCKS.length} のはず）`];
  }
  blocks.forEach((b, i) => {
    if (b?.id !== BLOCKS[i].id) reasons.push(`${i + 1} 番目のブロックが ${BLOCKS[i].id} ではない`);
    const values = b?.values;
    const keys = values && typeof values === "object" ? Object.keys(values) : [];
    if (keys.length !== KINDS.length || KINDS.some((k) => !keys.includes(k.id))) {
      reasons.push(`${BLOCKS[i].id} の種類が決まった3つではない`);
      return;
    }
    for (const k of KINDS) {
      const row = values[k.id];
      if (!Array.isArray(row) || row.length !== TYPES.length) {
        reasons.push(`${BLOCKS[i].id} の ${k.label} が4マスではない`);
        continue;
      }
      row.forEach((v, t) => {
        if (!Number.isInteger(v) || !LEVEL_VALUES.includes(v)) {
          reasons.push(`${BLOCKS[i].id} の ${k.label} ${TYPES[t]}型 が決まった値ではない：${JSON.stringify(v)}`);
        }
      });
    }
    if (b.dateText !== null && cleanDateText(b.dateText) !== b.dateText) {
      reasons.push(`${BLOCKS[i].id} の日付の文字が決まった形ではない`);
    }
  });
  return reasons;
}

// 前の日と比べて、全部のブロックが一度に変わっていたら「不自然」とする。
// 元のページの乗っ取りや、大きな読み違いに気づくため。自動では出さず、人が確かめる。
export function findUnnaturalChange(snapshot, previous) {
  if (!previous || previous.status !== "ok" || !Array.isArray(previous.blocks)) return null;
  const changed = snapshot.blocks.filter((b, i) => JSON.stringify(b.values) !== JSON.stringify(previous.blocks[i]?.values));
  if (changed.length === BLOCKS.length) {
    return `${BLOCKS.length} ブロックすべての表示が、前の回から一度に変わった`;
  }
  return null;
}
