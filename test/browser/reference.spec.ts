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
  await expect(page.locator(".masthead")).not.toHaveCSS("border-bottom-style", "none");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
