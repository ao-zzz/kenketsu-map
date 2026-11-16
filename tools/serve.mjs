// 手元で dist/ を見るための小さなサーバー。site/_headers の設定（CSP など）も、Cloudflare Pages と同じように付ける。
// 使い方：node tools/serve.mjs [フォルダ（dist）] [番号（8730）]
// ブラウザで http://localhost:8730/ を開く。止めるときは Ctrl + C。
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.resolve(ROOT, process.argv[2] || "dist");
const port = Number(process.argv[3] || 8730);

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml; charset=utf-8" };

// _headers の読み方は、このサイトで使う形（"/*" と、決まった1つの住所）だけ
async function loadHeaders() {
  const rules = [];
  let current = null;
  for (const line of (await readFile(path.join(dir, "_headers"), "utf8")).split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    if (!/^\s/.test(line)) {
      current = { pattern: line.trim(), headers: [] };
      rules.push(current);
    } else if (current) {
      const i = line.indexOf(":");
      current.headers.push([line.slice(0, i).trim(), line.slice(i + 1).trim()]);
    }
  }
  return (urlPath) => rules.filter((r) => r.pattern === "/*" || r.pattern === urlPath).flatMap((r) => r.headers);
}

const headersFor = await loadHeaders();

http
  .createServer(async (req, res) => {
    let urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    if (urlPath.endsWith("/")) urlPath += "index.html";
    const file = path.join(dir, urlPath);
    if (!file.startsWith(dir + path.sep) || path.basename(file) === "_headers") {
      res.writeHead(404).end();
      return;
    }
    try {
      const body = await readFile(file);
      for (const [k, v] of headersFor(urlPath === "/index.html" ? "/" : urlPath)) res.setHeader(k, v);
      res.setHeader("content-type", TYPES[path.extname(file)] || "application/octet-stream");
      res.writeHead(200).end(body);
    } catch {
      res.writeHead(404).end();
    }
  })
  .listen(port, "127.0.0.1", () => console.log(`http://localhost:${port}/ で ${path.relative(ROOT, dir) || "."} を見られます（止めるときは Ctrl + C）`));
