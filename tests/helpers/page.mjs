// テスト用に、血液センターのページと同じ形の HTML を作る。
// 本物のページを写して置かない（日赤の文章をリポジトリに入れないため）。形だけをまねる。
import { KINDS, LEVELS, TYPES } from "../../reader/blocks.mjs";

const label = (v) => LEVELS.find((l) => l.v === v)?.label ?? "（不明）";

// values: { "400": [A,O,B,AB], "200": [...], plasma: [...] }。v には文字も入れられる（変な値のテスト用）
export function makePage({ dateText = "11/13～11/19の状況(11/12更新)", values, tabs, override } = {}) {
  const vals = values ?? { 400: [0, 0, 0, 0], 200: [100, 100, 100, 100], plasma: [0, 25, 50, 100] };
  const tabLabels = tabs ?? KINDS.map((k) => k.label);
  const item = (type, v) => `
    <li class="center-main-today-types-item">
      <p class="center-main-today-types-name"><span>${type}</span>型</p>
      <div class="center-main-today-types-txts">
        <p class="center-main-today-types-state">${override?.label ?? label(Number(v))}</p>
        <figure class="center-main-today-types-ico"><img src="../../common/img/base/ico_bloodHeart_${v}_rd.svg" alt=""></figure>
      </div>
    </li>`;
  const lists = KINDS.map(
    (k, i) => `<ul class="center-main-today-types mod-tabSecs-item${i === 0 ? " on" : ""}">${(override?.types ?? TYPES)
      .map((t, j) => item(t, vals[k.id][j]))
      .join("")}</ul>`,
  ).join("");
  const date = dateText === null ? "" : `<p class="center-main-today-timedate">${dateText}</p>`;
  return `<!doctype html><html><body>
  <section class="center-main-today">
    <h2 class="center-main-today-h"><a href="./m0_06_donation.html">献血状況</a></h2>
    ${date}
    <ul class="center-main-today-btns mod-tabBtns">${tabLabels.map((t) => `<li class="center-main-today-btns-item mod-tabBtns-item">${t}</li>`).join("")}</ul>
    <div class="mod-tabSecs">${lists}</div>
  </section>
  </body></html>`;
}
