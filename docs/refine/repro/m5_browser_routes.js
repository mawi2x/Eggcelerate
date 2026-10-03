// biome-ignore lint/correctness/noUnusedVariables: Invoked by Playwright CLI.
async function verifyRoutes(page) {
  const browser = page.context().browser();
  const results = [];
  const routes = [
    ["/alerts", "Notification Center"],
    ["/login", "Check on your clutch."],
    ["/onboarding/1", "Let’s set up your farm."],
    ["/settings", "Settings"],
    ["/incubators", "Incubators"],
    ["/trends", "Historical Trends"],
    ["/candling", "Candling Logs"],
    ["/incubators/chamber-1", "Chamber One"],
  ];
  for (const [route, heading] of routes) {
    const context = await browser.newContext({
      viewport: { width: 393, height: 852 },
    });
    const tab = await context.newPage();
    const errors = [];
    const requests = [];
    tab.on("pageerror", (error) => errors.push(error.message));
    tab.on("request", (request) => requests.push(request.url()));
    await tab.goto(`http://127.0.0.1:5176${route}`);
    await tab.getByRole("heading", { name: heading, exact: true }).waitFor();
    await tab.locator("[data-route-loading]").waitFor({ state: "detached" });
    await tab.evaluate(() => document.fonts.ready);
    if (errors.length) throw new Error(`${route}: ${errors.join("; ")}`);
    if (requests.some((url) => !url.startsWith("http://127.0.0.1:5176/")))
      throw new Error("Unexpected external asset request");
    results.push({ route, directNavigation: "passed", externalRequests: 0 });
    await context.close();
  }
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const tab = await context.newPage();
  await context.route("**/assets/SettingsScreen-*.js", (route) =>
    route.abort(),
  );
  await tab.goto("http://127.0.0.1:5176/settings");
  await tab
    .getByRole("heading", { name: "This screen couldn’t load", exact: true })
    .waitFor();
  await tab
    .getByRole("navigation", { name: "Primary navigation", exact: true })
    .waitFor();
  await context.unroute("**/assets/SettingsScreen-*.js");
  await tab.getByRole("button", { name: "Try again", exact: true }).click();
  await tab.getByRole("heading", { name: "Settings", exact: true }).waitFor();
  await tab
    .getByRole("navigation", { name: "Settings categories", exact: true })
    .waitFor();
  await tab.getByRole("button", { name: "Incubators", exact: true }).click();
  await tab.getByRole("heading", { name: "Incubators", exact: true }).waitFor();
  await tab.goBack();
  await tab.getByRole("heading", { name: "Settings", exact: true }).waitFor();
  results.push({
    failedSettingsChunk: "shell retained; explicit retry reloaded successfully",
    navigationAndBack: "passed",
  });
  await context.close();
  return results;
}
