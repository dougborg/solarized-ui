import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const types: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

/** Serves the built reference site; run `pnpm build` first. */
const server = createServer(async (req, res) => {
  const path = new URL(req.url ?? "/", "http://localhost").pathname;
  const file = normalize(path === "/" ? "index.html" : path.slice(1));
  if (file.startsWith("..")) {
    res.writeHead(404).end();
    return;
  }
  try {
    const data = await readFile(join("site", file));
    res.writeHead(200, { "Content-Type": types[extname(file)] ?? "text/plain; charset=utf-8" });
    res.end(data);
  } catch {
    res.writeHead(404).end();
  }
});
server.listen(Number(process.env.PORT ?? 4173), "127.0.0.1", () => {
  const address = server.address();
  if (address && typeof address !== "string")
    console.log(`Preview: http://127.0.0.1:${address.port}`);
});
