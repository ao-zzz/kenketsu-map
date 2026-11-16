// 配るデータ（data.json）を作るところのテスト。表の 2・3・4。
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { publicData } from "../build/build.mjs";
import { BLOCKS } from "../reader/blocks.mjs";

const good = () => ({
  checkedAt: "2026-11-14T22:00:00.000Z",
  status: "ok",
  blocks: BLOCKS.map((b) => ({ id: b.id, dateText: "2026/11/14", values: { 400: [0, 0, 0, 0], 200: [100, 100, 100, 100], plasma: [25, 25, 50, 0] } })),
});

describe("配るデータ（data.json）", () => {
  test("ふつうのデータは、そのまま出す", () => {
    const out = publicData(good());
    assert.equal(out.status, "ok");
    assert.equal(out.blocks.length, 7);
  });

  test("止まったときは、値を1つも出さない（古い値も出さない）", () => {
    const out = publicData({ checkedAt: "2026-11-14T22:00:00.000Z", status: "stopped", reason: "読み取りで止まった" });
    assert.deepEqual(out, { status: "stopped", checkedAt: "2026-11-14T22:00:00.000Z" });
  });

  test("止まった理由は公開しない", () => {
    const out = publicData({ checkedAt: "x", status: "stopped", reason: "ひみつの理由" });
    assert.equal(JSON.stringify(out).includes("ひみつの理由"), false);
  });

  test("表の 2：配る直前にも、決まった値以外があれば止める", () => {
    const data = good();
    data.blocks[0].values["400"][0] = 75;
    assert.equal(publicData(data).status, "stopped");
  });

  test("表の 4：日付の場所に <script> があれば止める", () => {
    const data = good();
    data.blocks[1].dateText = "<script>alert(1)</script>";
    assert.equal(publicData(data).status, "stopped");
  });

  test("表の 3：データのファイルがない・壊れているときは止める", () => {
    assert.equal(publicData(null).status, "stopped");
    assert.equal(publicData({}).status, "stopped");
  });

  test("決まった項目のほかは出さない", () => {
    const data = good();
    data.blocks[0].extra = "<b>余計なもの</b>";
    data.secret = "余計なもの";
    assert.equal(JSON.stringify(publicData(data)).includes("余計なもの"), false);
  });
});
