// Playwright CLI run-code --filename; local fixture app on :5176.
// biome-ignore lint/correctness/noUnusedVariables: Invoked by Playwright CLI.
async function verifyOverviewSummary(page) {
  const results = [];
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const width of [320, 375, 639, 767, 768, 900, 1023, 1024, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    await page.waitForTimeout(400);
    const measurement = await page.evaluate(() => {
      const summary = document.querySelector(
        'section[aria-labelledby="overview-today-title"]',
      );
      const tiles = [...summary.querySelectorAll("dl > div")];
      return {
        width: innerWidth,
        scroll: document.documentElement.scrollWidth,
        columns: getComputedStyle(
          summary.querySelector("dl"),
        ).gridTemplateColumns.split(" ").length,
        tileOverflow: tiles.some(
          (tile) => tile.scrollWidth > tile.clientWidth + 1,
        ),
        buttonHeight: summary.querySelector("button").getBoundingClientRect()
          .height,
      };
    });
    results.push(measurement);
    if ([375, 900, 1440].includes(width)) {
      await page.screenshot({
        path: `output/playwright/overview-summary-${width}.png`,
      });
    }
  }
  const contrast = await page.evaluate(() => {
    const summary = document.querySelector(
      'section[aria-labelledby="overview-today-title"]',
    );
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const luminance = (color) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
      const channels = [...ctx.getImageData(0, 0, 1, 1).data]
        .slice(0, 3)
        .map((value) => {
          const n = value / 255;
          return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
        });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    const background = luminance(getComputedStyle(summary).backgroundColor);
    const ratio = (selector) => {
      const foreground = luminance(
        getComputedStyle(summary.querySelector(selector)).color,
      );
      return (
        (Math.max(background, foreground) + 0.05) /
        (Math.min(background, foreground) + 0.05)
      );
    };
    return {
      primary: ratio("p"),
      accent: ratio("p span"),
      secondary: ratio("dt"),
    };
  });
  await page.setViewportSize({ width: 375, height: 800 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  await page.waitForTimeout(400);
  const enlarged = await page.evaluate(() => {
    const summary = document.querySelector(
      'section[aria-labelledby="overview-today-title"]',
    );
    return {
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
      summaryScroll: summary.scrollWidth,
      summaryWidth: summary.clientWidth,
    };
  });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "";
  });
  return { results, contrast, enlarged, errors };
}
