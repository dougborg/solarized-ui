import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";

const script = stripTypeScriptTypes(await readFile("src/theme.ts", "utf8"));

function mount({ supported = true, reducedMotion = false } = {}) {
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
    querySelector: () => icon,
    setAttribute: (name: string, value: string) => attributes.set(name, value),
    addEventListener: (_event: string, handler: () => void) => {
      click = handler;
    },
  };
  const root = { dataset: {} as Record<string, string> };
  runInNewContext(script, {
    document: { querySelector: () => button, documentElement: root },
    CSS: { supports: () => supported },
    matchMedia: () => ({ matches: reducedMotion }),
  });
  return {
    button,
    icon,
    root,
    attributes,
    click: () => click(),
    animations: () => animations,
    cancellations: () => cancellations,
  };
}

test("theme control starts in auto and cycles with accessible current and next labels", () => {
  const ui = mount();
  assert.equal(ui.button.hidden, false);
  const glyphs = new Set<string>();
  for (const [mode, current, next] of [
    ["auto", "Auto (system theme)", "Light"],
    ["light", "Light", "Dark"],
    ["dark", "Dark", "Auto (system theme)"],
  ]) {
    assert.equal(ui.root.dataset.theme, mode);
    assert.equal(ui.attributes.get("aria-label"), `Theme: ${current}. Switch to ${next}.`);
    assert.equal(ui.button.title, ui.attributes.get("aria-label"));
    glyphs.add(ui.icon.textContent);
    ui.click();
  }
  assert.equal(glyphs.size, 3);
  assert.equal(ui.root.dataset.theme, "auto");
  assert.equal(ui.animations(), 3);
  assert.equal(ui.cancellations(), 2);
});

test("reduced motion keeps the full theme cycle without animations", () => {
  const ui = mount({ reducedMotion: true });
  ui.click();
  ui.click();
  assert.equal(ui.root.dataset.theme, "dark");
  assert.equal(ui.animations(), 0);
});

test("unsupported theme CSS leaves the unavailable control hidden", () => {
  const ui = mount({ supported: false });
  assert.equal(ui.button.hidden, true);
  ui.click();
  assert.equal(ui.root.dataset.theme, undefined);
  assert.equal(ui.animations(), 0);
});
