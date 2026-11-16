// セキュリティの表（idea-box/ideas/730-security-checklist.md）の 2〜5 を確かめるテスト。
// 実行：npm test
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { BLOCKS } from "../reader/blocks.mjs";
import { parseStatusPage, ReadError } from "../reader/parse.mjs";
import { cleanDateText } from "../reader/validate.mjs";
import { decide, readAll } from "../reader/run.mjs";
import { makePage } from "./helpers/page.mjs";

const stopsWith = (code) => (err) => err instanceof ReadError && err.code === code;

// 7ブロック分の読み取りを、本物のサーバーに行かずに試す
const fakeFetcher = (pageFor) => async (url) => pageFor(BLOCKS.findIndex((b) => url.includes(`/${b.id}/${b.center}/`)));
const readWith = (pageFor) => readAll({ fetcher: fakeFetcher(pageFor), wait: 0 });

describe("ふつうのページ", () => {
  test("12マスと日付を正しく読める", () => {
    const got = parseStatusPage(makePage());
    assert.deepEqual(got.values, { 400: [0, 0, 0, 0], 200: [100, 100, 100, 100], plasma: [0, 25, 50, 100] });
    assert.equal(got.dateText, "11/13～11/19の状況(11/12更新)");
  });

  test("7ブロック読んで、出してよいと判断する", async () => {
    const snapshot = await readWith(() => makePage());
    assert.equal(decide(snapshot, null).status, "ok");
  });
});

describe("表の 2：決まった4つの値（0・25・50・100）しか受け付けない", () => {
  for (const bad of ["75", "-1", "abc", "075", "25.0", ""]) {
    test(`絵の番号が「${bad}」なら止まる`, () => {
      const page = makePage({ values: { 400: [bad, 0, 0, 0], 200: [100, 100, 100, 100], plasma: [0, 0, 0, 0] } });
      assert.throws(() => parseStatusPage(page), (err) => err instanceof ReadError);
    });
  }

  test("言葉と絵の番号が合わなければ止まる", () => {
    const page = makePage({ override: { label: "安心です" }, values: { 400: [0, 0, 0, 0], 200: [0, 0, 0, 0], plasma: [0, 0, 0, 0] } });
    assert.throws(() => parseStatusPage(page), stopsWith("label-mismatch"));
  });

  test("出す直前にも、決まった値以外があれば止める", () => {
    const blocks = BLOCKS.map((b) => ({ id: b.id, dateText: null, values: { 400: [0, 0, 0, 0], 200: [0, 0, 0, 0], plasma: [0, 0, 0, 0] } }));
    blocks[3].values["200"][2] = 75;
    const result = decide({ blocks }, null);
    assert.equal(result.status, "stopped");
    assert.equal(result.blocks, undefined, "止まったときは値を出さない");
  });
});

describe("表の 3：形が違えば、古い値を出さずに止まる", () => {
  test("空っぽのページ", () => {
    assert.throws(() => parseStatusPage(""), stopsWith("empty"));
  });
  test("「献血状況」の場所がないページ", () => {
    assert.throws(() => parseStatusPage("<html><body>メンテナンス中です</body></html>"), stopsWith("no-section"));
  });
  test("種類のタブが違う（並びが変わった）", () => {
    assert.throws(() => parseStatusPage(makePage({ tabs: ["200mL", "400mL", "成分献血"] })), stopsWith("tabs"));
  });
  test("血液型が3つしかない", () => {
    assert.throws(() => parseStatusPage(makePage({ override: { types: ["A", "O", "B"] } })), stopsWith("items"));
  });
  test("血液型の並びが違う", () => {
    assert.throws(() => parseStatusPage(makePage({ override: { types: ["O", "A", "B", "AB"] } })), stopsWith("type-order"));
  });
  test("1つのブロックでも読めなければ、全体を止めて値を出さない", async () => {
    await assert.rejects(readWith((i) => (i === 4 ? "<html>形が変わった</html>" : makePage())));
  });
});

describe("表の 4：日付の文字は、決まった文字だけ。HTML として出さない", () => {
  test("<script> は日付として使わない", () => {
    assert.equal(cleanDateText("<script>alert(1)</script>"), null);
  });
  test("<img onerror> は日付として使わない", () => {
    assert.equal(cleanDateText("<img src=x onerror=alert(1)>"), null);
  });
  test("ページの中で <script> が日付の場所に入っていても、タグは消えて日付は使われない", async () => {
    const snapshot = await readWith((i) => (i === 0 ? makePage({ dateText: "<script>alert(1)</script>" }) : makePage()));
    assert.equal(snapshot.blocks[0].dateText, null);
    assert.equal(decide(snapshot, null).status, "ok", "日付が使えないだけで、値は出してよい");
  });
  test("41文字以上の日付は使わない", () => {
    assert.equal(cleanDateText("1".repeat(41)), null);
  });
  test("実際のページにある日付の書き方は使える", () => {
    for (const ok of ["11月4日17時現在（北海道）", "2026/11/09", "11/6～11/12の状況(11/5更新)", "令和８年１１月５日～", "令和8年11月10日現在", "2026/11/9時点"]) {
      assert.equal(cleanDateText(ok), ok, ok);
    }
  });
  test("日付ではない文（近畿のページ）は使わない", () => {
    assert.equal(cleanDateText("希望献血種類を選択願います。"), null);
  });
});

describe("表の 5：全部のブロックが一度に変わったら、自動では出さない", () => {
  const all = (v) => BLOCKS.map((b) => ({ id: b.id, dateText: null, values: { 400: [v, v, v, v], 200: [v, v, v, v], plasma: [v, v, v, v] } }));
  const previous = { status: "ok", blocks: all(0) };

  test("7ブロックすべてが変わったら止まる", () => {
    const result = decide({ blocks: all(100) }, previous);
    assert.equal(result.status, "stopped");
    assert.match(result.reason, /人が確かめるまで出さない/);
  });
  test("人が確かめて許せば出す", () => {
    assert.equal(decide({ blocks: all(100) }, previous, { approveBigChange: true }).status, "ok");
  });
  test("一部のブロックだけ変わったのは、ふつうに出す", () => {
    const next = all(0);
    next[2].values["400"] = [25, 25, 25, 25];
    assert.equal(decide({ blocks: next }, previous).status, "ok");
  });
});
