// biome-ignore lint/correctness/noUnusedVariables: Invoked by Playwright CLI.
async function measureLoading(page) {
  // Run with playwright-cli run-code --filename. Requires loopback previews:
  // baseline on 5177, current build on 5176. Firefox, cold contexts, 393x852.
  // Explicit profile: 150ms request latency, shared 200,000 bytes/s download.
  // Preview responses are uncompressed; this is not a production gzip claim.
  const results = [];
  for (const [label, port] of [
    ["baseline", 5177],
    ["M5", 5176],
  ]) {
    const context = await page
      .context()
      .browser()
      .newContext({ viewport: { width: 393, height: 852 } });
    const tab = await context.newPage();
    let transferEnd = 0;
    const requests = [];
    const responses = new Map();
    const errors = [];
    tab.on("pageerror", (error) => errors.push(error.message));
    await context.route("**/*", async (route) => {
      try {
        const url = route.request().url();
        // Routing disables browser HTTP cache. Deduplicate repeated identical
        // resources here to model normal in-page caching on a cold navigation.
        if (!responses.has(url)) {
          responses.set(
            url,
            (async () => {
              const response = await route.fetch({ timeout: 10000 });
              const body = await response.body();
              const now = Date.now();
              transferEnd =
                Math.max(now + 150, transferEnd) +
                (body.length / 200000) * 1000;
              // Intentional delay implementing the network profile, not a UI wait.
              await tab.waitForTimeout(Math.max(0, transferEnd - now));
              requests.push({
                url,
                bytes: body.length,
                status: response.status(),
              });
              return { response, body };
            })(),
          );
        }
        const { response, body } = await responses.get(url);
        await route.fulfill({ response, body });
      } catch (error) {
        errors.push(`${route.request().url()}: ${error.message}`);
        await route.abort();
      }
    });
    const start = Date.now();
    await tab.goto(`http://127.0.0.1:${port}/`, {
      waitUntil: "domcontentloaded",
    });
    await tab
      .getByRole("heading", {
        name: /Good day|Good morning|Good afternoon|Good evening|Good day|Good /,
      })
      .first()
      .waitFor({ timeout: 20000 });
    const contentMs = Date.now() - start;
    await tab.evaluate(() => document.fonts.ready);
    await tab.waitForLoadState("networkidle");
    const readyMs = Date.now() - start;
    results.push({
      label,
      contentMs,
      readyMs,
      transferredBodyBytes: requests.reduce((sum, item) => sum + item.bytes, 0),
      requestCount: requests.length,
      requests,
      errors,
    });
    await context.close();
  }
  return results;
}
