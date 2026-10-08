import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";

const script = stripTypeScriptTypes(await readFile("src/theme.ts", "utf8"));

function mount({
  supported = true,
  reducedMotion = false,
  saved = null as string | null,
  readDenied = false,
  writeDenied = false,
  storageDenied = false,
  missingButton = false,
  missingIcon = false,
} = {}) {
  let click = () => {};
  let animations = 0;
  let cancellations = 0;
  const icon = {
    textContent: "",
    animate: () => animations++,
    getAnimations: () => (animations ? [{ cancel: () => cancellations++ }] : []),
  };
  const attributes = new Map<string, string>();
  const button = {
    hidden: true,
    title: "",
    querySelector: () => (missingIcon ? null : icon),
    setAttribute: (name: string, value: string) => attributes.set(name, value),
    addEventListener: (_event: string, handler: () => void) => {
      click = handler;
    },
  };
  const root = { dataset: {} as Record<string, string> };
  const writes: [string, string][] = [];
  runInNewContext(script, {
    document: { querySelector: () => (missingButton ? null : button), documentElement: root },
    CSS: { supports: () => supported },
    matchMedia: () => ({ matches: reducedMotion }),
    get localStorage() {
      if (storageDenied) throw new Error("Storage access denied");
      return {
        getItem: (key: string) => {
          assert.equal(key, "solarized-ui-theme");
          if (readDenied) throw new Error("Storage read denied");
          return saved;
        },
        setItem: (key: string, value: string) => {
          if (writeDenied) throw new Error("Storage write denied");
          writes.push([key, value]);
        },
      };
    },
  });
  return {
    button,
    icon,
    root,
    attributes,
    writes,
    click: () => click(),
    animations: () => animations,
    cancellations: () => cancellations,
  };
}

test("theme control starts in dark and cycles with accessible current and next labels", () => {
  const ui = mount();
  assert.equal(ui.button.hidden, false);
  const glyphs = new Set<string>();
  assert.deepEqual(ui.writes, [], "the default is not an explicit visitor selection");
  for (const [mode, current, next] of [
    ["dark", "Dark", "Auto (system theme)"],
    ["auto", "Auto (system theme)", "Light"],
    ["light", "Light", "Dark"],
  ]) {
    assert.equal(ui.root.dataset.theme, mode);
    assert.equal(ui.attributes.get("aria-label"), `Theme: ${current}. Switch to ${next}.`);
    assert.equal(ui.button.title, ui.attributes.get("aria-label"));
    glyphs.add(ui.icon.textContent);
    ui.click();
  }
  assert.equal(glyphs.size, 3);
  assert.equal(ui.root.dataset.theme, "dark");
  assert.deepEqual(ui.writes, [
    ["solarized-ui-theme", "auto"],
    ["solarized-ui-theme", "light"],
    ["solarized-ui-theme", "dark"],
  ]);
  assert.equal(ui.animations(), 3);
  assert.equal(ui.cancellations(), 2);
});

test("reduced motion keeps the full theme cycle without animations", () => {
  const ui = mount({ reducedMotion: true });
  ui.click();
  ui.click();
  assert.equal(ui.root.dataset.theme, "light");
  assert.equal(ui.animations(), 0);
});

test("every saved visitor choice is restored without overwriting storage", () => {
  for (const saved of ["auto", "light", "dark"]) {
    const ui = mount({ saved });
    assert.equal(ui.root.dataset.theme, saved);
    assert.deepEqual(ui.writes, []);
    assert.equal(ui.button.hidden, false);
  }
});

test("invalid and unreadable preferences fall back to dark with working controls", () => {
  for (const options of [
    { saved: "unexpected" },
    { saved: "" },
    { readDenied: true },
    { writeDenied: true },
    { storageDenied: true },
  ]) {
    const ui = mount(options);
    assert.equal(ui.root.dataset.theme, "dark");
    ui.click();
    assert.equal(ui.root.dataset.theme, "auto");
    ui.click();
    assert.equal(ui.root.dataset.theme, "light");
  }
});

test("pages without complete theme controls do not read storage or change the root", () => {
  for (const options of [{ missingButton: true }, { missingIcon: true }]) {
    const ui = mount({ ...options, storageDenied: true });
    assert.equal(ui.button.hidden, true);
    assert.equal(ui.root.dataset.theme, undefined);
    assert.deepEqual(ui.writes, []);
  }
});

test("unsupported theme CSS leaves the unavailable control hidden", () => {
  const ui = mount({ supported: false });
  assert.equal(ui.button.hidden, true);
  ui.click();
  assert.equal(ui.root.dataset.theme, undefined);
  assert.equal(ui.animations(), 0);
});
