// Run with Playwright CLI run-code --filename. Local fixture-mode app only.
// biome-ignore lint/correctness/noUnusedVariables: Invoked by Playwright CLI.
async function verifyResponsiveMatrix(page) {
  const widths = [320, 375, 639, 640, 767, 768, 900, 1023, 1024, 1440];
  const routes = [
    "/",
    "/incubators",
    "/candling",
    "/trends",
    "/alerts",
    "/settings",
    "/incubators/chamber-1",
  ];
  const results = [];
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const route of routes) {
    await page.goto(`http://127.0.0.1:5176${route}`);
    await page.locator("main h1").waitFor();
    await page.evaluate(() => document.fonts.ready);
    for (const width of widths) {
      await page.setViewportSize({ width, height: 800 });
      // Allow the existing sidebar/layout transitions to finish before measuring.
      await page.waitForTimeout(400);
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      );
      const dimensions = await page.evaluate(() => {
        const root = document.documentElement;
        const main = document.querySelector("main");
        return {
          scroll: root.scrollWidth,
          client: root.clientWidth,
          mainWidth: main.getBoundingClientRect().width,
        };
      });
      results.push({ route, width, ...dimensions });
      if ([320, 900, 1440].includes(width)) {
        await page.screenshot({
          path: `output/playwright/responsive-${route.replaceAll("/", "_") || "home"}-${width}.png`,
        });
      }
    }
    await page.setViewportSize({ width: 1024, height: 480 });
    results.push({
      route,
      shortScreen: true,
      ...(await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }))),
    });
  }
  return {
    cases: results.length,
    overflow: results.filter((r) => r.scroll > r.client + 1),
    errors,
    results,
  };
}
