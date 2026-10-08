import { expect, test } from "@playwright/test";

const dark = "rgb(0, 43, 54)";
const light = "rgb(253, 246, 227)";
const key = "solarized-ui-theme";

for (const colorScheme of ["light", "dark"] as const) {
  for (const width of [390, 1440]) {
    test(`first visit defaults to dark with ${colorScheme} system at ${width}px`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      await page.goto("/");
      await expect(page.locator("body")).toHaveCSS("background-color", dark);
      await expect(page.locator("#theme-toggle")).toHaveAccessibleName(
        "Theme: Dark. Switch to Auto (system theme).",
      );
      expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBeNull();
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: info.outputPath("default-dark.png"), fullPage: true });
    });
  }
}

test("keyboard choices survive reload and page navigation, and Auto follows live system changes", async ({
  page,
}, info) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto("/");
  const toggle = page.locator("#theme-toggle");
  await toggle.focus();
  await expect(toggle).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAccessibleName("Theme: Auto (system theme). Switch to Light.");
  await expect(page.locator("body")).toHaveCSS("background-color", light);
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("body")).toHaveCSS("background-color", dark);
  await page.reload();
  await expect(toggle).toHaveAccessibleName("Theme: Auto (system theme). Switch to Light.");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("body")).toHaveCSS("background-color", light);
  await toggle.focus();
  await page.keyboard.press("Space");
  await expect(toggle).toHaveAccessibleName("Theme: Light. Switch to Dark.");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("body")).toHaveCSS("background-color", light);
  await page.goto("/article.html");
  await expect(toggle).toHaveAccessibleName("Theme: Light. Switch to Dark.");
  await expect(page.locator("body")).toHaveCSS("background-color", light);
  await page.screenshot({ path: info.outputPath("saved-light.png"), fullPage: true });
  await toggle.click();
  await page.reload();
  await expect(toggle).toHaveAccessibleName("Theme: Dark. Switch to Auto (system theme).");
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe("dark");
  expect(await toggle.evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
});

test("invalid saved choices use dark and blocked storage does not disable switching", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("solarized-ui-theme", "invalid"));
  await page.reload();
  await expect(page.locator("body")).toHaveCSS("background-color", dark);
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("Storage blocked", "SecurityError");
      },
    });
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.reload();
  await page.locator("#theme-toggle").click();
  await expect(page.locator("#theme-toggle")).toHaveAccessibleName(
    "Theme: Auto (system theme). Switch to Light.",
  );
  await page.locator("#theme-toggle").click();
  await expect(page.locator("body")).toHaveCSS("background-color", light);
  expect(errors).toEqual([]);
});

test("without scripts the CSS defaults to dark on a light system and permits explicit Auto", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false, colorScheme: "light" });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.locator("body")).toHaveCSS("background-color", dark);
  await expect(page.locator("#theme-toggle")).toBeHidden();
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "auto";
  });
  await expect(page.locator("body")).toHaveCSS("background-color", light);
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("body")).toHaveCSS("background-color", dark);
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("body")).toHaveCSS("color", "rgb(0, 0, 0)");
  await context.close();
});
