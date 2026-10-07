import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { fileURLToPath } from "node:url";
import { configElement } from "@dougborg/site-analytics";
import { privacyUrl, siteAnalytics } from "./site-analytics.ts";

/** Stylesheet sources, concatenated in cascade order. */
const stylesheets = [
  "fonts",
  "tokens",
  "base",
  "components",
  "site",
  "patterns",
  "quiet",
  "prose",
] as const;

const fontsource = {
  "ibm-plex-sans": ["400-normal", "500-normal", "600-normal", "700-normal", "400-italic"],
  "jetbrains-mono": ["400-normal", "500-normal"],
} as const;

const nerdFonts = [
  "jetbrains-mono-nerd-400.woff2",
  "jetbrains-mono-nerd-600.woff2",
  "jetbrains-mono-nerd-LICENSE",
] as const;

async function fonts() {
  const files = new Map<string, Buffer>();
  for (const [pkg, variants] of Object.entries(fontsource)) {
    for (const variant of variants) {
      const file = `${pkg}-latin-${variant}.woff2`;
      files.set(`fonts/${file}`, await readFile(`node_modules/@fontsource/${pkg}/files/${file}`));
    }
    files.set(`fonts/${pkg}-LICENSE`, await readFile(`node_modules/@fontsource/${pkg}/LICENSE`));
  }
  for (const file of nerdFonts) files.set(`fonts/${file}`, await readFile(`fonts/${file}`));
  return files;
}

/** The published package contents, keyed by path under `dist/`. */
export async function packageFiles(): Promise<Map<string, Buffer>> {
  const styles = await Promise.all(
    stylesheets.map((name) => readFile(`src/css/${name}.css`, "utf8")),
  );
  const theme = stripTypeScriptTypes(await readFile("src/theme.ts", "utf8"), { mode: "strip" });
  return new Map([
    ["solarized-ui.css", Buffer.from(styles.join("\n"))],
    ["theme.js", Buffer.from(theme)],
    ["theme-control.html", await readFile("src/theme-control.html")],
    ...(await fonts()),
  ]);
}

/** The reference site: the package under `assets/` plus the reference page. */
export async function siteFiles(): Promise<Map<string, Buffer>> {
  const files = new Map<string, Buffer>();
  for (const [path, bytes] of await packageFiles()) files.set(`assets/${path}`, bytes);
  const control = await readFile("src/theme-control.html", "utf8");
  if (siteAnalytics) {
    const module = fileURLToPath(import.meta.resolve("@dougborg/site-analytics/analytics.js"));
    files.set(ANALYTICS_ASSET, await readFile(module));
  }
  for (const page of ["index.html", "article.html", "status.html"]) {
    const html = await readFile(`reference/${page}`, "utf8");
    files.set(page, Buffer.from(withAnalytics(html.replace("{{theme_control}}", control))));
  }
  files.set("favicon.svg", await readFile("reference/favicon.svg"));
  return files;
}

const ANALYTICS_ASSET = "assets/site-analytics/analytics.js";

/**
 * Add the analytics config element and module to the page's head and a privacy link to its
 * footer, or leave the page untouched when analytics is off.
 */
function withAnalytics(html: string): string {
  if (!siteAnalytics) return html;
  const head = `${configElement(siteAnalytics)}\n<script type="module" src="${ANALYTICS_ASSET}"></script>\n`;
  const link = `<p><a href="${privacyUrl}">Privacy</a></p>\n`;
  if (!html.includes("</head>") || !html.includes("</footer>")) {
    throw new Error("reference page needs a </head> and a </footer> for analytics");
  }
  return html.replace("</head>", `${head}</head>`).replace("</footer>", `${link}</footer>`);
}
