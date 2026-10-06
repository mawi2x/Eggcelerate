// Playwright CLI run-code --filename; local fixture app on :5176.
// biome-ignore lint/correctness/noUnusedVariables: Invoked by Playwright CLI.
async function verifyIncubatorsExtraction(page) {
  const results = [];
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const measure = async (width, view) => {
    await page.waitForTimeout(400);
    const dimensions = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    results.push({ width, view, ...dimensions });
    await page.screenshot({
      path: `output/playwright/m6-incubators-${width}-${view}.png`,
    });
  };
  for (const width of [320, 768, 900, 1440]) {
    await page.setViewportSize({ width, height: 480 });
    if (width >= 768)
      await page
        .getByRole("button", { name: "Grid view", exact: true })
        .click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await measure(width, "grid");
    if (width >= 768) {
      await page
        .getByRole("button", { name: "List view", exact: true })
        .click();
      await measure(width, "list");
    }
    await page
      .getByRole("button", { name: "Add incubator", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    await measure(width, "dialog");
    const box = await dialog.boundingBox();
    const result = results[results.length - 1];
    result.dialogFits =
      box !== null &&
      box.x >= 0 &&
      box.y >= 0 &&
      box.x + box.width <= width + 1 &&
      box.y + box.height <= 481;
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
  }
  return {
    cases: results.length,
    overflow: results.filter((result) => result.scroll > result.client + 1),
    dialogFailures: results.filter((result) => result.dialogFits === false),
    errors,
    results,
  };
}
