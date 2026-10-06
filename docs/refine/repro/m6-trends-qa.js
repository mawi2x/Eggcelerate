// Run with Playwright CLI run-code --filename against the fixture app on :5176.
// biome-ignore lint/correctness/noUnusedVariables: Invoked by Playwright CLI.
async function verifyTrendsExtraction(page) {
  const results = [];
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const width of [320, 768, 900, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    for (const tab of ["Environmental Trends", "Hatch History"]) {
      await page.getByRole("button", { name: tab, exact: true }).click();
      await page.evaluate(() => {
        window.scrollTo(0, 0);
        document.querySelector("main")?.scrollTo(0, 0);
      });
      await page.waitForTimeout(400);
      const dimensions = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }));
      results.push({ width, tab, ...dimensions });
      await page.screenshot({
        path: `output/playwright/m6-trends-${width}-${tab.startsWith("Hatch") ? "history" : "chart"}.png`,
      });
    }
  }
  return {
    cases: results.length,
    overflow: results.filter((result) => result.scroll > result.client + 1),
    errors,
    results,
  };
}
