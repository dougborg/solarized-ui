import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { packageFiles, siteFiles } from "../src/bundle.ts";

const files = await packageFiles();
const css = files.get("solarized-ui.css")?.toString("utf8") ?? "";

test("every stylesheet URL resolves to a packaged file", () => {
  const urls = [...css.matchAll(/url\("([^"]+)"\)/g)].map((match) => match[1]);
  assert.ok(urls.length > 0);
  for (const url of urls) assert.ok(files.has(url), `missing ${url}`);
});

test("every packaged font family ships its license", () => {
  const families = new Set(
    [...files.keys()]
      .filter((path) => path.endsWith(".woff2"))
      .map((path) => path.replace(/^fonts\//, "").replace(/-(latin|\d).*$/, "")),
  );
  assert.deepEqual([...families].sort(), [
    "ibm-plex-sans",
    "jetbrains-mono",
    "jetbrains-mono-nerd",
  ]);
  for (const family of families) assert.ok(files.has(`fonts/${family}-LICENSE`), family);
});

test("package exports point at built files", async () => {
  const manifest = JSON.parse(await readFile("package.json", "utf8"));
  for (const [name, target] of Object.entries<string>(manifest.exports)) {
    if (name === "./package.json") continue;
    const path = target.replace(/^\.\/dist\//, "");
    if (path.endsWith("*")) {
      const prefix = path.slice(0, -1);
      assert.ok(
        [...files.keys()].some((file) => file.startsWith(prefix)),
        name,
      );
    } else assert.ok(files.has(path), name);
  }
  assert.equal(manifest.style, "./dist/solarized-ui.css");
  assert.deepEqual(manifest.files, ["dist", "THIRD_PARTY_NOTICES.md"]);
});

test("the theme module is plain JavaScript and the control loads it", () => {
  const theme = files.get("theme.js")?.toString("utf8") ?? "";
  assert.doesNotMatch(theme, /\bas const\b|<HTML/);
  assert.match(files.get("theme-control.html")?.toString("utf8") ?? "", /src="assets\/theme\.js"/);
});

test("the stylesheet uses only the exact Solarized values", () => {
  const hex = new Set(css.match(/#[0-9a-f]{6}\b/gi)?.map((value) => value.toLowerCase()));
  const official = new Set([
    "#002b36",
    "#073642",
    "#586e75",
    "#657b83",
    "#839496",
    "#93a1a1",
    "#eee8d5",
    "#fdf6e3",
    "#b58900",
    "#cb4b16",
    "#dc322f",
    "#d33682",
    "#6c71c4",
    "#268bd2",
    "#2aa198",
    "#859900",
  ]);
  for (const value of hex) assert.ok(official.has(value), value);
});

test("derived tints come only from the exact accents' hues", () => {
  const derived = [...css.matchAll(/oklch\(from (\S+) (\S+) (\S+) (\S+)\)/g)]
    // The @supports feature test uses a placeholder color, not one that renders.
    .filter(([, source]) => source !== "red");
  assert.ok(derived.length >= 16, "a light and a dark tint for each accent");
  for (const [expression, source, , , hue] of derived) {
    assert.match(source, /^var\(--solarized-[a-z]+\)$/, expression);
    assert.equal(hue, "h", `${expression} keeps its source hue`);
  }
  assert.doesNotMatch(css, /\b(rgba?|hsla?|hwb|lab|lch|color-mix)\(/);
});

test("transparency appears only in the shadow color, derived from an exact base", () => {
  const translucent = [...css.matchAll(/oklch\(from (\S+) (\S+) (\S+) (\S+) \/ ([^)]+)\)/g)]
    // The @supports feature test uses a placeholder color, not one that renders.
    .filter(([, source]) => source !== "red");
  assert.equal(translucent.length, 1, "one shadow color");
  const [expression, source, l, c, h, alpha] = translucent[0];
  assert.equal(source, "var(--solarized-base03)", expression);
  assert.deepEqual([l, c, h], ["l", "c", "h"], `${expression} keeps its source color`);
  assert.ok(Number.parseFloat(alpha) <= 10, `${expression} stays faint`);
  const declaration = css.slice(0, translucent[0].index).split(/[;{]/).at(-1) ?? "";
  assert.match(
    declaration,
    /--shadow-color:\s*light-dark\($/,
    "only --shadow-color is translucent",
  );
  assert.doesNotMatch(css, /opacity\s*:/);
});

test("the reference site serves the package under assets/", async () => {
  const site = await siteFiles();
  for (const [path, bytes] of files) assert.deepEqual(site.get(`assets/${path}`), bytes);
  for (const name of ["index.html", "article.html", "status.html"]) {
    const page = site.get(name)?.toString("utf8") ?? "";
    assert.doesNotMatch(page, /{{/, name);
    assert.match(page, /href="assets\/solarized-ui\.css"/, name);
  }
});
