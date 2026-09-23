import { readdir, readFile } from "node:fs/promises";
import { AxeBuilder } from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

async function expectReflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    (page.viewportSize()?.width ?? 0) + 1,
  );
}

for (const colorScheme of ["light", "dark"] as const) {
  for (const width of [320, 1440]) {
    test(`reference ${colorScheme} at ${width}px renders accessible components`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      const failures: string[] = [];
      page.on("response", (response) => {
        if (!response.ok()) failures.push(response.url());
      });
      page.on("requestfailed", (request) => failures.push(request.url()));
      await page.goto("/");
      await page.evaluate(() => document.fonts.ready);
      await expectReflow(page);
      expect(failures).toEqual([]);
      const officialAccents = {
        blue: "rgb(38, 139, 210)",
        cyan: "rgb(42, 161, 152)",
        green: "rgb(133, 153, 0)",
        yellow: "rgb(181, 137, 0)",
        orange: "rgb(203, 75, 22)",
        red: "rgb(220, 50, 47)",
        magenta: "rgb(211, 54, 130)",
        violet: "rgb(108, 113, 196)",
      };
      for (const [hue, color] of Object.entries(officialAccents)) {
        await expect(page.locator(`.swatch[data-accent="${hue}"]`)).toHaveCSS(
          "border-top-color",
          color,
        );
      }

      expect(
        (await new AxeBuilder({ page }).analyze()).violations.map((violation) => ({
          id: violation.id,
          nodes: violation.nodes.map((node) => ({
            target: node.target,
            problem: node.failureSummary,
          })),
        })),
      ).toEqual([]);
      const action = page.getByRole("link", { name: "View the source" });
      await action.hover();
      expect((await new AxeBuilder({ page }).include("#reuse").analyze()).violations).toEqual([]);
      await page.mouse.move(0, 0);
      await page.keyboard.press("Tab");
      await expect(page.locator(".skip-link")).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("main")).toBeFocused();
      await expect(page.getByText("Ready", { exact: true })).toBeVisible();
      await expect(page.getByText("Maintenance", { exact: true })).toBeVisible();
      const toggle = page.getByRole("button", { name: /Theme:/ });
      await toggle.click();
      await expect(toggle).toHaveAccessibleName("Theme: Light. Switch to Dark.");
      await toggle.click();
      await expect(toggle).toHaveAccessibleName("Theme: Dark. Switch to Auto (system theme).");
      await toggle.click();
      await expect(toggle).toHaveAccessibleName("Theme: Auto (system theme). Switch to Light.");
      expect(
        await page
          .locator("#reuse ol > li")
          .first()
          .evaluate((el) => getComputedStyle(el, "::marker").content),
      ).toBe("normal");
      await page.evaluate(() =>
        Promise.all(document.getAnimations().map((animation) => animation.finished)),
      );
      await page.screenshot({ path: info.outputPath("reference.png"), fullPage: true });
    });
  }
}

test("reference works without scripts and reflows at double text size", async ({ browser }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    colorScheme: "dark",
    viewport: { width: 320, height: 844 },
  });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(0, 43, 54)");
  await expect(page.locator(".theme-toggle")).toBeHidden();
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  await expectReflow(page);
  await page.emulateMedia({ forcedColors: "active" });
  await page.keyboard.press("Tab");

  await context.close();
});

test("copied package files work under another site subdirectory", async ({ page }) => {
  const files = [
    "solarized-ui.css",
    "theme.js",
    ...(await readdir("dist/fonts")).map((file) => `fonts/${file}`),
  ];
  const copied = new Map<string, Buffer>(
    await Promise.all(
      files.map(async (file) => [`assets/${file}`, await readFile(`dist/${file}`)] as const),
    ),
  );
  const control = await readFile("dist/theme-control.html", "utf8");
  copied.set(
    "index.html",
    Buffer.from(
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Portable consumer</title><link rel="stylesheet" href="assets/solarized-ui.css"></head><body><main id="main"><h1>Portable consumer</h1><section class="content-section" data-accent="cyan"><h2 class="section-title">Services</h2><article class="surface">Shared component</article></section></main>${control}</body></html>`,
    ),
  );
  const missing: string[] = [];
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== "http://portable.test" || !url.pathname.startsWith("/portable/")) {
      missing.push(url.href);
      await route.abort();
      return;
    }
    const file = new URL(route.request().url()).pathname.replace("/portable/", "");
    const body = copied.get(file);
    if (!body) {
      missing.push(file);
      await route.fulfill({ status: 404 });
      return;
    }
    const contentType = file.endsWith(".css")
      ? "text/css"
      : file.endsWith(".js")
        ? "text/javascript"
        : file.endsWith(".woff2")
          ? "font/woff2"
          : "text/html";
    await route.fulfill({ body, contentType });
  });
  await page.goto("http://portable.test/portable/index.html");
  await page.evaluate(() => document.fonts.ready);
  expect(missing).toEqual([]);
  expect(
    await page.evaluate(
      () =>
        document.fonts.check('16px "IBM Plex Sans"') &&
        document.fonts.check('19px "JetBrains Mono Nerd Font"'),
    ),
  ).toBe(true);
  await expect(page.locator(".surface")).toHaveCSS("border-radius", "4px");
  const toggle = page.getByRole("button", { name: /Theme:/ });
  await toggle.click();
  await expect(toggle).toHaveAccessibleName("Theme: Light. Switch to Dark.");
});

test("legacy light fallback retains readable text on official surfaces", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    for (const sheet of document.styleSheets) {
      for (let index = sheet.cssRules.length - 1; index >= 0; index--) {
        if (sheet.cssRules[index] instanceof CSSSupportsRule) sheet.deleteRule(index);
      }
    }
  });
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(253, 246, 227)");
  expect(
    (await new AxeBuilder({ page }).analyze()).violations.map((violation) => ({
      id: violation.id,
      nodes: violation.nodes.map((node) => node.failureSummary),
    })),
  ).toEqual([]);
});

test("print replaces the nested-list marker", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await page.emulateMedia({ media: "print" });
  const nested = page.locator(".supporting-details > li").first();
  await expect(nested).toBeAttached();
  expect(await nested.evaluate((el) => getComputedStyle(el, "::marker").content)).toBe('"\u00b7 "');
});

test("print uses black text and hides the theme control", async ({ page }) => {
  await page.goto("/");
  await page.emulateMedia({ media: "print", colorScheme: "dark" });
  await expect(page.locator("body")).toHaveCSS("color", "rgb(0, 0, 0)");
  await expect(page.locator(".theme-toggle")).toBeHidden();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

for (const colorScheme of ["light", "dark"] as const) {
  for (const width of [320, 1440]) {
    test(`article ${colorScheme} at ${width}px renders accessible site and prose components`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      const failures: string[] = [];
      page.on("response", (response) => {
        if (!response.ok()) failures.push(response.url());
      });
      await page.goto("/article.html");
      await page.evaluate(() => document.fonts.ready);
      await expectReflow(page);
      expect(failures).toEqual([]);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      for (const link of await page.locator(".site-nav a, .masthead-title a").all()) {
        expect((await link.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
      }
      await expect(page.locator('.site-nav a[aria-current="page"]')).toHaveCSS(
        "text-decoration-line",
        "underline",
      );
      const code = page.locator(".prose pre").first();
      const ink = await code.evaluate((el) => getComputedStyle(el).color);
      await expect(code.locator(".token.keyword").first()).toHaveCSS("font-weight", "600");
      await expect(code.locator(".token.keyword").first()).toHaveCSS("color", ink);
      await expect(code.locator(".token.comment").first()).toHaveCSS("font-style", "italic");
      await expect(code.locator(".token.comment").first()).toHaveCSS("color", ink);
      // At the end of the page the floating theme control must not cover any text.
      await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
      const toggle = await page.locator(".theme-toggle").boundingBox();
      const covered = await page.evaluate((box) => {
        if (!box) return ["no toggle"];
        const overlaps = (rect: DOMRect) =>
          rect.right > box.x &&
          rect.left < box.x + box.width &&
          rect.bottom > box.y &&
          rect.top < box.y + box.height;
        const hits: string[] = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          if (!node.textContent?.trim() || node.parentElement?.closest(".theme-toggle")) continue;
          const range = document.createRange();
          range.selectNodeContents(node);
          if ([...range.getClientRects()].some(overlaps)) hits.push(node.textContent.trim());
        }
        return hits;
      }, toggle);
      expect(covered).toEqual([]);
      await page.screenshot({ path: info.outputPath("article.png"), fullPage: true });
    });
  }
}

test("article keeps content without scripts and drops navigation in print", async ({ browser }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    colorScheme: "dark",
    viewport: { width: 320, height: 844 },
  });
  const page = await context.newPage();
  await page.goto("/article.html");
  await expect(page.locator(".theme-toggle")).toBeHidden();
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  await expectReflow(page);
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".site-nav")).toBeHidden();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("body")).toHaveCSS("color", "rgb(0, 0, 0)");
  await context.close();
});

test("article supports keyboard navigation and forced colors", async ({ page }) => {
  await page.goto("/article.html");
  await page.keyboard.press("Tab");
  await expect(page.locator(".skip-link")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator(".masthead-title a")).toBeFocused();
  for (const name of ["Components", "Article", "Source"]) {
    await page.keyboard.press("Tab");
    const link = page.locator(".site-nav").getByRole("link", { name });
    await expect(link).toBeFocused();
    await expect(link).toHaveCSS("outline-style", "solid");
  }
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  await page.emulateMedia({ forcedColors: "active" });
  // The banded masthead draws its rule with ::after, which forced colors turn to CanvasText.
  expect(
    await page
      .locator(".masthead")
      .evaluate((el) => getComputedStyle(el, "::after").backgroundColor),
  ).not.toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`site patterns take their accents and tints in ${colorScheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto("/#patterns");
    await expectReflow(page);
    const patterns = page.locator("#patterns");
    expect(
      await patterns.locator(".accent-band").evaluate((el) => getComputedStyle(el).backgroundImage),
    ).toContain("linear-gradient");
    const rail = await patterns
      .locator(".timeline-list > li[data-accent='cyan']")
      .evaluate((el) => getComputedStyle(el, "::before").backgroundColor);
    expect(rail).toBe("rgb(42, 161, 152)");

    // Tints differ by accent, and none is the neutral surface when relative color is supported.
    const backgrounds = await patterns
      .locator(".card")
      .evaluateAll((cards) => cards.map((card) => getComputedStyle(card).backgroundColor));
    expect(new Set(backgrounds).size).toBe(3);
    const neutral = await page
      .locator(".swatch")
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(backgrounds).not.toContain(neutral);

    // Markers never overlap the text beside them.
    for (const item of await patterns.locator(".timeline-list > li").all()) {
      const heading = await item.locator(".entry-title").boundingBox();
      const marker = await item.evaluate((li) => {
        const custom = li.querySelector(".timeline-marker");
        if (custom) return custom.getBoundingClientRect().right;
        const rect = li.getBoundingClientRect();
        return rect.left + Number.parseFloat(getComputedStyle(li, "::after").width);
      });
      expect(marker).toBeLessThanOrEqual(heading?.x ?? 0);
    }
    expect((await new AxeBuilder({ page }).include("#patterns").analyze()).violations).toEqual([]);
  });
}

test("the reading bar fills with scrolling and stays out of print and reduced motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 600 });
  await page.goto("/article.html");
  const bar = page.locator(".read-progress");
  const width = () => bar.evaluate((el) => el.getBoundingClientRect().width);
  expect(await width()).toBe(0);
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(width).toBeGreaterThan(1000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(bar).toBeHidden();
  await page.emulateMedia({ reducedMotion: "no-preference", media: "print" });
  await expect(bar).toBeHidden();
  await expect(page.locator(".pager")).toBeHidden();
});

test("site patterns stay visible in forced colors", async ({ page }) => {
  await page.goto("/#patterns");
  await page.emulateMedia({ forcedColors: "active" });
  const card = page.locator("#patterns .card").first();
  await expect(card).not.toHaveCSS("outline-style", "none");
  expect(
    await page
      .locator("#patterns .timeline-list > li")
      .first()
      .evaluate((el) => getComputedStyle(el, "::before").backgroundColor),
  ).not.toMatch(/rgba\(0, 0, 0, 0\)/);
  expect((await new AxeBuilder({ page }).include("#patterns").analyze()).violations).toEqual([]);
});

const axeViolations = async (page: Page) =>
  (await new AxeBuilder({ page }).analyze()).violations.map((violation) => ({
    id: violation.id,
    nodes: violation.nodes.map((node) => node.target),
  }));

for (const colorScheme of ["light", "dark"] as const) {
  for (const width of [320, 1440]) {
    test(`status page ${colorScheme} at ${width}px is accessible and quiet`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme });
      await page.goto("/status.html");
      await page.evaluate(() => document.fonts.ready);
      await expectReflow(page);
      expect(await axeViolations(page)).toEqual([]);
      await expect(page.getByRole("status").first()).toContainText("Service disruption detected");
      for (const state of ["Operational", "Degraded", "Outage", "Online"]) {
        await expect(page.getByText(state, { exact: true }).first()).toBeVisible();
      }
      const shadow = await page
        .locator(".panel")
        .first()
        .evaluate((el) => getComputedStyle(el).boxShadow);
      if (colorScheme === "light") expect(shadow).toMatch(/oklch|rgba?\(/);
      else expect(shadow).toMatch(/none|rgba\(0, 0, 0, 0\)|oklch\([^)]*\/ 0\)|transparent/);
      await page.screenshot({
        path: info.outputPath(`status-${colorScheme}-${width}.png`),
        fullPage: true,
      });
    });
  }
}

test("a forced theme switches the quiet surfaces too", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/status.html");
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  const panel = page.locator(".panel.panel-rows").first();
  await expect(panel).toHaveCSS("background-color", "rgb(7, 54, 66)");
  // Dark panels have no shadow, so their edge must differ from their surface.
  await expect(panel).toHaveCSS("border-top-color", "rgb(88, 110, 117)");
  expect(await axeViolations(page)).toEqual([]);
});

test("marked rows take their state's tint and edge, and pills keep a ring", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/status.html");
  const panel = page.locator(".panel.panel-rows").first();
  const panelColor = await panel.evaluate((el) => getComputedStyle(el).backgroundColor);
  const down = page.locator('tr[data-state="down"]');
  const cell = down.locator("th");
  const tint = await cell.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(tint).not.toBe(panelColor);
  // The leading edge is the exact Solarized red.
  expect(await cell.evaluate((el) => getComputedStyle(el).boxShadow)).toContain("rgb(220, 50, 47)");
  const pill = down.locator(".status--pill");
  expect(await pill.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(panelColor);
  expect(await pill.evaluate((el) => getComputedStyle(el).boxShadow)).toContain("rgb(220, 50, 47)");
  const callout = page.locator(".callout--tinted");
  expect(await callout.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(panelColor);
  expect(await callout.evaluate((el) => getComputedStyle(el).boxShadow)).toMatch(
    /rgb\(220, 50, 47\) 4px 0px 0px 0px inset/,
  );

  // The outer rows round their leading corners so the edge curves with the panel, as a callout's does.
  const rows = page.locator(".panel-rows tbody tr");
  await expect(rows.first().locator("th")).toHaveCSS("border-top-left-radius", "11px");
  await expect(rows.last().locator("th")).toHaveCSS("border-bottom-left-radius", "11px");
  await expect(rows.nth(1).locator("th")).toHaveCSS("border-top-left-radius", "0px");
  // A one-row list is both the first and the last row.
  const only = page.locator("ul.panel-rows > li").first();
  await expect(only).toHaveCSS("border-top-left-radius", "11px");
  await expect(only).toHaveCSS("border-bottom-left-radius", "11px");

  await page.setViewportSize({ width: 320, height: 900 });
  // Stacked, the row itself carries the tint and edge.
  expect(await down.evaluate((el) => getComputedStyle(el).boxShadow)).toContain("rgb(220, 50, 47)");
  expect(await down.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(tint);
  await expect(down).toHaveCSS("border-bottom-left-radius", "11px");
});

const row = (name: string) => `<tr data-state="down"><th>${name}</th><td>x</td></tr>`;
const rows = (...names: string[]) => `<tbody>${names.map(row).join("")}</tbody>`;
const hiddenHead = '<thead class="visually-hidden"><tr><th>A</th><th>B</th></tr></thead>';
const tableShapes: Record<string, string> = {
  "a hidden head": hiddenHead + rows("a", "b", "c"),
  "no head": rows("a", "b"),
  "a visible head": `<thead><tr><th>A</th><th>B</th></tr></thead>${rows("a", "b")}`,
  "a visible caption": `<caption>Services</caption>${rows("a", "b")}`,
  "a hidden caption": `<caption class="visually-hidden">Services</caption>${rows("a", "b")}`,
  "several bodies": hiddenHead + rows("a", "b") + rows("c", "d"),
  "an empty first body": `${hiddenHead}<tbody></tbody>${rows("a", "b")}<tbody></tbody>`,
  "a foot before the body": `${hiddenHead}<tfoot>${row("f")}</tfoot>${rows("a", "b")}`,
  "a single row": hiddenHead + rows("a"),
  "a nested table": `<tbody><tr data-state="down"><th>a</th><td><table>${rows("n", "m")}</table></td></tr></tbody>`,
};

/** Lists each marked row whose rounded leading corners differ from the panel corners it touches. */
function misplacedCorners(panel: HTMLElement): string[] {
  const stacked = getComputedStyle(panel.querySelector("tr") as Element).display === "flex";
  const box = panel.getBoundingClientRect();
  return [...panel.querySelectorAll("tr[data-state]")].flatMap((tr) => {
    const edge = (stacked ? tr : tr.firstElementChild) as Element;
    const rect = edge.getBoundingClientRect();
    const style = getComputedStyle(edge);
    const top = Math.abs(rect.top - box.top - 1) < 1.5;
    const bottom = Math.abs(rect.bottom - box.bottom + 1) < 1.5;
    const rounded = [style.borderStartStartRadius, style.borderEndStartRadius].map(
      (r) => r !== "0px",
    );
    return rounded[0] === top && rounded[1] === bottom ? [] : [edge.textContent ?? ""];
  });
}

for (const width of [1440, 320]) {
  test(`only rows touching the panel's corners curve, at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/status.html");
    const panel = page.locator(".panel.panel-rows").first();
    for (const [shape, html] of Object.entries(tableShapes)) {
      await panel.evaluate((el, inner) => {
        el.innerHTML = `<table class="table--stack">${inner}</table>`;
      }, html);
      expect(await panel.evaluate(misplacedCorners), shape).toEqual([]);
    }
  });
}

test("a marked row's edge follows the text direction", async ({ page }) => {
  await page.goto("/status.html");
  const cell = page.locator('tr[data-state="down"] th');
  expect(await cell.evaluate((el) => getComputedStyle(el).boxShadow)).toMatch(
    / 4px 0px 0px 0px inset/,
  );
  await page.evaluate(() => document.documentElement.setAttribute("dir", "rtl"));
  expect(await cell.evaluate((el) => getComputedStyle(el).boxShadow)).toMatch(
    / -4px 0px 0px 0px inset/,
  );
});

test("accent rows take their accent's tint and edge", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const row = page.locator('.panel-rows > li[data-accent="cyan"]');
  expect(await row.evaluate((el) => getComputedStyle(el).boxShadow)).toContain("rgb(42, 161, 152)");
  const panelColor = await row
    .locator("xpath=..")
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(await row.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(panelColor);
});

test("the status table stacks into labelled rows on narrow screens", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/status.html");
  const row = page.locator(".table--stack tbody tr").first();
  const [name, status, latency] = await Promise.all(
    ["th", "td >> nth=0", "td >> nth=1"].map((cell) => row.locator(cell).boundingBox()),
  );
  expect(status && name && status.y).toBeGreaterThanOrEqual(
    (name?.y ?? 0) + (name?.height ?? 0) - 1,
  );
  // Latency follows the status: beside it, or on the next line when a pill leaves no room.
  expect(latency?.y ?? 0).toBeGreaterThanOrEqual((status?.y ?? 0) - 5);
  expect(latency?.y ?? 0).toBeLessThan((status?.y ?? 0) + (status?.height ?? 0) + 8);
  expect(
    await row
      .locator("td")
      .nth(1)
      .evaluate((el) => getComputedStyle(el, "::before").content),
  ).toBe('"Latency "');
  await expect(page.getByRole("rowheader", { name: /Website/ })).toBeVisible();

  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(row.locator("td").nth(1)).toHaveCSS("display", "table-cell");
});

test("quiet patterns keep their edges in forced colors and drop shadows in print", async ({
  page,
}) => {
  await page.goto("/status.html");
  await page.emulateMedia({ forcedColors: "active" });
  const panel = page.locator(".panel").first();
  await expect(panel).not.toHaveCSS("border-top-style", "none");
  expect(
    await page
      .locator(".status[data-state]")
      .first()
      .evaluate((el) => getComputedStyle(el, "::before").backgroundColor),
  ).not.toMatch(/rgba\(0, 0, 0, 0\)/);
  expect(await axeViolations(page)).toEqual([]);
  await page.emulateMedia({ forcedColors: "none", media: "print" });
  await expect(panel).toHaveCSS("box-shadow", "none");
  // Shadows are dropped in print, so the leading edges become borders.
  await expect(page.locator(".callout--tinted")).toHaveCSS(
    "border-left",
    "4px solid rgb(220, 50, 47)",
  );
  await expect(page.locator('tr[data-state="down"] th')).toHaveCSS(
    "border-left",
    "4px solid rgb(220, 50, 47)",
  );
});
