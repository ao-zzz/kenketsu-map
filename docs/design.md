# 作り方の設計（2026-11-13）

ユーザーが「いいよ」と言い、書き始めた。3つに分けて進める。

1. **読み取りと確かめ、テスト**（できた 2026-11-13）：`reader/`、`tests/reader.test.mjs`（表の 2〜5、25個）。`npm test` で全部通る。本物の7ページを1回読んで `data/latest.json` ができた（全部 ok）。テストのページは本物を写さず、形だけまねて作る（日赤の文章をリポジトリに入れないため）
2. **画面（案6）、フォントを自分で配る、`_headers`**（できた 2026-11-14）：`site/`（index.html、style.css、app.js、map.js、fonts/、_headers）、`build/build.mjs`（dist/ を作る。配る直前にも形を確かめ、理由は公開しない）、`tools/serve.mjs`（_headers をつけて手元で見る）、`tools/fetch-fonts.mjs`（Google Fonts のうち使う文字を含む 132 個・1.5MB だけを一度取ってくる。外の部品なし）。画面の文字はすべて textContent で入れ、innerHTML は使わない。ページの中に直接書いたスクリプトと見た目の指定をなくし、CSP は `script-src 'self'; style-src 'self'`。確かめ用の画面は `npm run check:stopped`・`check:bad-value`・`check:script`（dist-test/ に作るので配られない）。テストは `tests/build.test.mjs` を足して 32 個
   - 分かったこと：WebKit（Windows 版）は、都道府県を選ぶ欄（`<select>`）を描くときに、ブラウザが自分で使う見た目の指定で CSP の警告（style-src-attr）を出す。ページの書き方ではなく、欄は動く。iPhone の実機でも出るかは、公開後に確かめる
   - `upgrade-insecure-requests` は外した（pages.dev は https だけなので要らない。手元の http の確かめで読み込みを壊した）
   - 検索（2026-11-15）：都道府県ごとのページ47（`build/pages.mjs`、JavaScript なし）、トップの表と都道府県の一覧を配る前に書き込む、robots.txt、sitemap.xml、canonical。`site.config.json` の `siteUrl`（pages.dev の住所）と `indexable`（検索に載せるか）で切り替える。テスト43個
3. GitHub と Cloudflare につなぐ（ユーザーのアカウントの操作が要る）
   - 2026-11-17：非公開のリポジトリ `ao-zzz/kenketsu-map` に送った（SSH）。`.github/workflows/daily.yml` を書いた：毎朝 7:00（日本時間）と手で押したときだけ動く、全体の権限は読むだけでジョブだけ書ける、部品はコミットの番号で固定（checkout v7.0.1、setup-node v7.1.0）、wrangler は `deploy/` に分けて 4.155.0（出て2週間以上たった版）を package-lock.json で中身まで固定し、`--ignore-scripts` で入れる。はじめての1回だけ手でプロジェクトを作り、住所が `kenketsu-map.pages.dev` でなければ配らずに止める。止まった日も値なしの画面を配ってから失敗にする
   - 2026-11-18：公開した（ユーザー「いいよ」）。Cloudflare は専用アカウント `kenketsu-map`、鍵は「Cloudflare Pages：編集」だけ・そのアカウントだけ・期限1年（2027-11-18 ごろ切れる。切れると毎朝の配る段で失敗するので、その前に同じ権限で作り直して Secrets を入れかえる）。公開後に 404.html を足した（Pages は 404.html がないと、どんな住所にもトップを返す）。Google Search Console の確認用ファイル `site/google6e392e7aefedfdf0.html` は**消さない**（消すと確認が外れる）。Pages は `.html` 付きの住所を `.html` なしへ 308 で移すが、確認は通った
   - 同じ日に足した守り：前の日が止まっても、最後にうまく読めた回と比べる（`pickPrevious`）。画面は data.json が2日より古ければ止まった表示にする（毎朝の仕組みそのものが動かなかったとき）。ただし都道府県のページは JavaScript なしなので古い値が残る。読み取った日時を出しているのと、失敗のメールで気づく

最初のコミット（2026-11-17）：名前とメールは、このリポジトリだけ GitHub の代わりのアドレスにした（`git config` を `.git/config` に。公開したとき履歴に出るため。表の 17）。記録する前に、鍵・Gmail・パソコンの住所の文字がないかを探した（見つからなかった）。

## 全体の流れ

```
毎朝1回（GitHub Actions）
  ① 読む     7ブロックのページを、1秒以上あけて1回ずつ読む
  ② 確かめる 決まった形か（7ブロック × 3種類 × 4型、値は 0・25・50・100 だけ、日付の文字は短く決まった文字だけ）
             不自然な変化（7ブロック全部が一度に変わる など）は自動で出さず、止めて知らせる
  ③ 書く     data/latest.json と data/history/日付.json をリポジトリに記録（いつ何を読んだかが履歴に残る）
  ④ 配る     site/ と latest.json を Cloudflare Pages へ
             ②で止まったときは「今日は読み取れませんでした。元のページをご覧ください」の表示を配る（古い値は出さない）
```

公開されるのはファイルだけ。ログイン、書き込み、データベースはない。

## フォルダ

```
kenketsu-map/
  docs/                 idea.md（入口）、design.md（これ）
  reader/
    read.mjs            ① 読む（Node の標準の fetch だけ。外の部品は使わない）
    parse.mjs           ページの HTML から12マスと日付の文字を取り出す
    validate.mjs        ② 確かめる。合わなければ理由をつけて止める
  data/
    latest.json         いま出している値（状態「ok」か「stopped」つき）
    history/            毎日の記録
  site/
    index.html          見た目は案6（6-gentle.html）を元にする
    app.js, map.js      画面の動き、地図
    _headers            セキュリティの設定（CSP など）
  tests/                チェックリストの 2〜5 を確かめるテスト（Node の標準のテストの仕組み。外の部品なし）
  .github/workflows/
    daily.yml           毎朝の ①〜④
```

## セキュリティの決めごととの対応

チェックリスト（`~/idea-box/ideas/730-security-checklist.md`）の番号。

| 番号 | どこで守るか |
|---|---|
| 1 ファイルだけ | site/ は静的なファイルだけ。Pages の Functions は使わない |
| 2 決まった値だけ | validate.mjs。テストで 75、-1、"abc" を入れて止まるか |
| 3 形が違えば止める | validate.mjs。テストで項目が足りない、空っぽのページを入れて止まるか |
| 4 文字を HTML にしない | 画面は textContent だけで文字を入れる（innerHTML に読んだ文字を入れない）。テストで `<script>` を入れる |
| 5 不自然な変化は止める | validate.mjs が前の日の値と比べる |
| 6 外を読み込まない | フォントは外から読まない（下の「決めること」） |
| 7 CSP | `_headers` で自分のスクリプトだけ許可、よそのサイトの枠の中に表示させない |
| 8 7ページ・1日1回 | read.mjs の URL の一覧と daily.yml の時刻 |
| 13 異常を知らせる | ②で止まったら Actions が失敗になり、GitHub からメールが届く |
| 16 鍵 | Cloudflare の鍵は Secrets。権限は Pages に配るだけ。daily.yml の権限も最小 |

## まだ決めること（ユーザーが選ぶ）

1. ~~文字の形（フォント）~~ → **決まった（2026-11-13）**：見本と同じ しっぽり明朝 B1（800）と Zen 角ゴシック New（500・700・900）のファイルを、自分で配る。どちらも SIL Open Font License（自分で配ってよい。ライセンスの文をつける）。日本語のフォントは重いので、ページで使う文字（固定の文、都道府県名、日赤の4段階の言葉、数字と日付の文字）だけに絞る。絞った中にない文字は端末の文字で出る。端末の文字（游明朝、ゴシック）も比べたが、ユーザーが「細く見にくい」「もっとダメ」と言った（比べた画像は `~/idea-box/experiments/730-blood-map/history/`）
2. 毎朝の時刻（ページの更新は各ブロックでばらばら。朝7時ごろを考えている）
3. ~~「〇〇.pages.dev」の名前~~ → **決まった（2026-11-17）**：`kenketsu-map.pages.dev`。`site.config.json` に入れた。Cloudflare で作るときに、この名前のまま取れたかを確かめる（ほかの人が使っていると後ろに文字が足され、正式な住所と sitemap がずれる）
