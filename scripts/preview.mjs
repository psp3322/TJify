#!/usr/bin/env node
/**
 * 빌드한 정적 사이트(out/)를 GitHub Pages처럼 띄워 보는 작은 서버.
 *
 *   npm run build && npm run preview
 *   NEXT_PUBLIC_BASE_PATH=/TJify npm run build && NEXT_PUBLIC_BASE_PATH=/TJify npm run preview
 */
import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";

const root = resolve("out");
const base = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "");
const port = Number(process.env.PORT) || 4173;
const host = process.env.HOST || "127.0.0.1";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function stat(path) {
  try {
    return statSync(path);
  } catch {
    return null;
  }
}

function send(res, status, file) {
  res.writeHead(status, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
}

createServer((req, res) => {
  const { pathname, search } = new URL(req.url ?? "/", "http://localhost");
  if (base && (pathname === "/" || pathname === base)) {
    res.writeHead(302, { Location: `${base}/${search}` });
    return res.end();
  }
  const notFound = () => (stat(join(root, "404.html")) ? send(res, 404, join(root, "404.html")) : (res.writeHead(404), res.end("Not found")));
  if (base && !pathname.startsWith(`${base}/`)) return notFound();

  const target = normalize(join(root, decodeURIComponent(pathname.slice(base.length))));
  if (target !== root && !target.startsWith(root + sep)) return notFound();
  const info = stat(target);
  if (info?.isDirectory()) {
    // GitHub Pages처럼 폴더 주소는 끝에 /를 붙여 index.html을 보여 준다
    if (!pathname.endsWith("/")) {
      res.writeHead(301, { Location: `${pathname}/${search}` });
      return res.end();
    }
    return stat(join(target, "index.html")) ? send(res, 200, join(target, "index.html")) : notFound();
  }
  if (info?.isFile()) return send(res, 200, target);
  if (stat(`${target}.html`)) return send(res, 200, `${target}.html`);
  return notFound();
}).listen(port, host, () => {
  console.log(`TJify 미리 보기: http://${host}:${port}${base}/`);
});
