import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { createServer } from "node:http";

const rootDir = resolve(import.meta.dirname, "..");
const distDir = resolve(rootDir, "dist");
const port = Number(process.env.PORT || 8031);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".csv": "text/csv; charset=utf-8",
};

function sendFile(res, filePath) {
  const ext = extname(filePath).toLowerCase();
  res.writeHead(200, {
    "Content-Type": mimeTypes[ext] || "application/octet-stream",
    "Cache-Control": "no-cache",
  });
  createReadStream(filePath).pipe(res);
}

function resolvePath(urlPath) {
  if (urlPath === "/" || urlPath === "") {
    return join(distDir, "index.html");
  }

  if (urlPath === "/sp500" || urlPath === "/sp500/") {
    return join(distDir, "index.html");
  }

  if (!urlPath.startsWith("/sp500/")) {
    return null;
  }

  const relativePath = urlPath.replace(/^\/sp500\//, "");
  const safePath = normalize(relativePath).replace(/^(\.\.[/\\])+/, "");
  let candidate = join(distDir, safePath);

  if (existsSync(candidate) && statSync(candidate).isFile()) {
    return candidate;
  }

  candidate = join(distDir, safePath, "index.html");
  if (existsSync(candidate) && statSync(candidate).isFile()) {
    return candidate;
  }

  return null;
}

createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);
  const filePath = resolvePath(url.pathname);

  if (!filePath) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  sendFile(res, filePath);
}).listen(port, "127.0.0.1", () => {
  console.log(`S&P 500 pages available at http://127.0.0.1:${port}/sp500/`);
});
