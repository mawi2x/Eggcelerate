// Playwright CLI reproduction; synthetic long text is DOM-only and never saved.
// biome-ignore lint/correctness/noUnusedVariables: Invoked by Playwright CLI.
async function verifyResponsiveStress(page) {
  const results = [];
  for (const width of [320, 375, 768, 1024]) {
    await page.setViewportSize({ width, height: 480 });
    await page.goto("http://127.0.0.1:5176/incubators");
    await page
      .getByRole("heading", { name: "Incubators", exact: true })
      .waitFor();
    await page
      .getByRole("heading", { name: "Chamber Twelve", exact: true })
      .waitFor();
    await page.evaluate(() => {
      document.querySelector("main h3").textContent =
        "North Barn Breeding Chamber With A Very Long Name";
    });
    await page.waitForTimeout(400);
    results.push({
      width,
      longName: await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    });
    await page.screenshot({ path: `output/playwright/long-name-${width}.png` });
    // Grid/list toggle is intentionally hidden in the mobile card layout.
    if (width >= 768)
      await page
        .getByRole("button", { name: "List view", exact: true })
        .click();
    results.push({
      width,
      list: await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    });
    await page
      .getByRole("button", { name: "Add incubator", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    await page.waitForTimeout(400);
    const box = await dialog.boundingBox();
    results.push({
      width,
      dialogFits:
        box.x >= 0 &&
        box.y >= 0 &&
        box.x + box.width <= width + 1 &&
        box.y + box.height <= 481,
    });
    await page.screenshot({
      path: `output/playwright/add-dialog-${width}.png`,
    });
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
  }
  await page.goto("http://127.0.0.1:5176/trends");
  await page.locator("#environmental-chart-title").waitFor();
  for (const width of [320, 375, 639, 640, 767, 768, 900, 1023, 1024, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    await page.waitForTimeout(400);
    results.push(
      await page.evaluate(() => {
        const title = document.querySelector("#environmental-chart-title");
        const controls = title.parentElement.nextElementSibling;
        const a = title.getBoundingClientRect();
        const b = controls.getBoundingClientRect();
        const overlap =
          a.left < b.right &&
          a.right > b.left &&
          a.top < b.bottom &&
          a.bottom > b.top;
        return {
          width: innerWidth,
          titleOverlap: overlap,
          pageOverflow: document.documentElement.scrollWidth > innerWidth,
        };
      }),
    );
    if ([320, 900, 1440].includes(width))
      await page.screenshot({
        path: `output/playwright/trends-fixed-${width}.png`,
      });
  }
  return results;
}
