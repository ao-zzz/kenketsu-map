// 読み取る相手と、受け付ける値の決まり。
// ここに書いていない URL は読まない（セキュリティの表の 8）。
// ここに書いていない値は受け付けない（セキュリティの表の 2）。

// 7つのブロック。同じブロックの中は全部同じ表示なので、ブロックごとに1ページだけ読む
// （2026-11-09 に 47 か所すべてを読んで確かめた。idea-box/ideas/730-blood-status-map.md）
export const BLOCKS = [
  { id: "hkd", name: "北海道", center: "hokkaido" },
  { id: "th", name: "東北", center: "miyagi" },
  { id: "ktks", name: "関東甲信越", center: "tokyo" },
  { id: "tkhr", name: "東海北陸", center: "aichi" },
  { id: "kk", name: "近畿", center: "osaka" },
  { id: "csk", name: "中四国", center: "hiroshima" },
  { id: "bc9", name: "九州", center: "fukuoka" },
];

export const pageUrl = (block) => `https://www.bs.jrc.or.jp/${block.id}/${block.center}/`;

// 血液型の並び（ページの並びと同じ）
export const TYPES = ["A", "O", "B", "AB"];

// 献血の種類。label はページのタブの文字と同じでなければ止める
export const KINDS = [
  { id: "400", label: "400mL" },
  { id: "200", label: "200mL" },
  { id: "plasma", label: "成分献血" },
];

// 4段階。v はページの絵の番号（ico_bloodHeart_{v}_*.svg）。label はページの文字と同じでなければ止める
export const LEVELS = [
  { v: 0, label: "非常に困ってます" },
  { v: 25, label: "困っています" },
  { v: 50, label: "心配です" },
  { v: 100, label: "安心です" },
];

export const LEVEL_VALUES = LEVELS.map((l) => l.v);
