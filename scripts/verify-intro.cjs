// Production-web visual smoke test. Supply an external Playwright tools folder;
// no browser automation dependency is added to the mobile application.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { createRequire } = require("node:module");
const requireTools = process.env.SAMANVI_PLAYWRIGHT_ROOT ? createRequire(path.join(process.env.SAMANVI_PLAYWRIGHT_ROOT, "package.json")) : require;
const { chromium } = requireTools("playwright");
const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");
const evidence = path.join(root, "docs", "intro-validation");
const mime = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".ttf": "font/ttf", ".json": "application/json" };
const server = http.createServer((request, response) => {
  let file = path.resolve(dist, "." + decodeURIComponent(request.url.split("?")[0]));
  if (!file.startsWith(dist + path.sep) && file !== dist) return response.writeHead(403).end();
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, "index.html");
  response.setHeader("Content-Type", mime[path.extname(file)] || "application/octet-stream");
  fs.createReadStream(file).pipe(response);
});

async function run() {
  fs.mkdirSync(evidence, { recursive: true });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({ headless: true, ...(process.env.SAMANVI_BROWSER_EXECUTABLE ? { executablePath: process.env.SAMANVI_BROWSER_EXECUTABLE } : {}) });
  const errors = [];
  try {
    for (const theme of ["dark", "light"]) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "no-preference" });
      const page = await context.newPage();
      page.on("pageerror", error => errors.push(error.message));
      await page.addInitScript(theme => localStorage.setItem("samanvi.theme.v1", theme), theme);
      await page.clock.install({ time: new Date("2026-10-20T12:00:00Z") });
      await page.clock.pauseAt(new Date("2026-10-20T12:00:01Z"));
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      await page.getByTestId("launch-intro").waitFor();
      // Load/decode all three static images while the animation clock is paused.
      await page.waitForFunction(() => Array.from(document.images).every(image => image.complete));
      await page.clock.runFor(100);
      await page.waitForFunction(() => Array.from(document.images).some(image => image.src.includes("samanvi-bus") && image.naturalWidth === 817));
      for (const [advance, label] of [[1200, "1300"], [400, "1700"], [600, "2300"]]) {
        await page.clock.runFor(advance);
        await page.screenshot({ path: path.join(evidence, `${theme}-${label}.png`) });
        if (label === "1300") {
          const opacity = await page.locator('img[src*="samanvi-bus"]').evaluate(image => Number(getComputedStyle(image.parentElement).opacity));
          assert.ok(opacity > 0.8, `Actual bus should be visible, got opacity ${opacity}`);
        }
      }
      await page.clock.runFor(700);
      assert.equal(await page.getByTestId("launch-intro").count(), 0, "Intro must dismiss");
      await page.getByRole("textbox", { name: "Username", exact: true }).waitFor();
      await context.close();
    }
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.getByRole("textbox", { name: "Username", exact: true }).waitFor();
    await page.getByTestId("launch-intro").waitFor({ state: "detached" });
    assert.equal(await page.locator('img[src*="samanvi-bus"]').count(), 0, "Reduced motion must bypass bus/scenery");
    await context.close();
    for (const scenario of ["failed-asset", "live-reduced-motion"]) {
      const context = await browser.newContext({ viewport: { width: 360, height: 740 }, reducedMotion: "no-preference" });
      const page = await context.newPage();
      page.on("pageerror", error => errors.push(error.message));
      if (scenario === "failed-asset") await page.route("**/*samanvi-bus*", route => route.abort());
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      if (scenario === "live-reduced-motion") {
        await page.locator('img[src*="samanvi-bus"]').waitFor({ state: "attached" });
        await page.emulateMedia({ reducedMotion: "reduce" });
      }
      await page.getByTestId("launch-intro").waitFor({ state: "detached" });
      await page.getByRole("textbox", { name: "Username", exact: true }).waitFor();
      assert.equal(await page.locator('img[src*="samanvi-bus"]').count(), 0);
      await context.close();
    }
    assert.deepEqual(errors, [], "No browser runtime errors");
    console.log("PASS: both themes, actual photo, logo exit, reduced motion, live preference change, failed asset and browser runtime checks.");
  } finally { await browser.close(); server.close(); }
}
run().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
