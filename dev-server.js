/* Tribal Cruize — local dev server (no dependencies).
 *
 *   node dev-server.js          -> http://localhost:8099
 *   PORT=3000 node dev-server.js
 *
 * The app needs http:// (not file://) for AI generation, uploads and the
 * Supabase client to work in the browser.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.TC_PORT || 8099;
const ROOT = __dirname;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".md": "text/plain; charset=utf-8",
  ".sql": "text/plain; charset=utf-8",
  ".ts": "text/plain; charset=utf-8",
};

const server = http
  .createServer((req, res) => {
    let urlPath;
    try {
      urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
    } catch (e) {
      res.writeHead(400).end("Bad request");
      return;
    }
    if (urlPath === "/") urlPath = "/tribal-cruize.html";

    // AI image proxy: the free image service refuses cross-origin browser
    // requests, so the dev server fetches on the app's behalf.
    if (urlPath === "/api/image") {
      const params = new URL(req.url, "http://localhost").searchParams;
      const prompt = (params.get("prompt") || "").slice(0, 800);
      const w = parseInt(params.get("w") || "1024", 10) || 1024;
      const h = parseInt(params.get("h") || "1024", 10) || 1024;
      if (!prompt) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing prompt" }));
        return;
      }
      const target =
        "https://image.pollinations.ai/prompt/" +
        encodeURIComponent(prompt) +
        `?width=${w}&height=${h}&nologo=true&seed=${Math.floor(Math.random() * 1e9)}`;
      fetch(target)
        .then(async (up) => {
          const buf = Buffer.from(await up.arrayBuffer());
          res.writeHead(up.status, {
            "Content-Type": up.headers.get("content-type") || "application/octet-stream",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-store",
          });
          res.end(buf);
        })
        .catch(() => {
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "image service unreachable" }));
        });
      return;
    }

    const filePath = path.join(ROOT, path.normalize(urlPath));
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403).end("Forbidden");
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not found: " + urlPath);
        return;
      }
      res.writeHead(200, {
        "Content-Type": TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream",
        "Cache-Control": "no-cache",
      });
      res.end(data);
    });
  });

server.listen(PORT, () => {
  console.log(`Tribal Cruize dev server → http://localhost:${server.address().port}`);
});
