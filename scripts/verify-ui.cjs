// Online-only browser regression audit. See docs/VERIFICATION.md.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { createRequire } = require("node:module");
const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist-ui-api");
const evidence = path.join(root, "docs/online-validation");
const requireTools = process.env.SAMANVI_PLAYWRIGHT_ROOT ? createRequire(path.join(process.env.SAMANVI_PLAYWRIGHT_ROOT, "package.json")) : require;
const { chromium } = requireTools("playwright");
const mime = { ".html": "text/html", ".js": "text/javascript", ".ttf": "font/ttf", ".png": "image/png", ".json": "application/json" };
const server = http.createServer((request, response) => {
  let file = path.resolve(dist, "." + decodeURIComponent(request.url.split("?")[0]));
  if (file !== dist && !file.startsWith(dist + path.sep)) { response.writeHead(403).end(); return; }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, "index.html");
  response.setHeader("Content-Type", mime[path.extname(file)] || "application/octet-stream");
  fs.createReadStream(file).pipe(response);
});

async function run() {
  fs.mkdirSync(evidence, { recursive: true });
  assert.ok(fs.existsSync(path.join(dist, "index.html")), "Export with the fixture API URL first");
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, ...(process.env.SAMANVI_BROWSER_EXECUTABLE ? { executablePath: process.env.SAMANVI_BROWSER_EXECUTABLE } : {}) });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  const errors = [];
  const checks = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("dialog", (dialog) => dialog.accept());
  const audios = ["Welcome Note 1", "Welcome Note 2", "Dinner Break", "Toilet Break", "Starting Point", "Next Stop"].map((title, i) => ({ id: `a${i}`, title, audioUrl: `https://announcements.example.test/media/a${i}.mp3`, mimeType: "audio/mpeg", durationMs: null }));
  const routes = [1, 2, 3, 4].map((i) => ({ id: `r${i}`, routeId: `ST-A0${i}`, startLocation: "Hyderabad", endLocation: i === 1 ? "Amalapuram" : `Destination ${i}`, via: "Vijayawada", busType: i % 2 ? "AC" : "Non-AC", isPinned: false }));
  const pins = new Set();
  const state = { fail: false, recordsDriveUrl: "https://drive.google.com/drive/folders/records-test", mediaRequests: 0, audioRequests: 0 };
  const cards = () => routes.map((route) => ({ ...route, isPinned: pins.has(route.id) }));
  const session = { accessToken: "fixture-access", refreshToken: "fixture-refresh", refreshTokenExpiresAt: "2099-01-01T00:00:00.000Z", user: { id: "driver-1", username: "driver", displayName: "Test Driver", driverId: null } };
  await page.addInitScript(() => { localStorage.setItem("samanvi.preferences.v3", JSON.stringify({ entered: true, keepAwake: true, requireSpeaker: false })); });
  await page.route("https://drive.google.com/**", async (intercept) => {
    await intercept.abort("aborted");
  });
  await page.route("https://announcements.example.test/**", async (intercept) => {
    const request = intercept.request();
    const url = new URL(request.url());
    const reply = (data, status = 200) => intercept.fulfill({ status, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "private, no-store" }, body: JSON.stringify(status === 200 ? { success: true, data } : data) });
    if (state.fail) return reply({ message: "Service temporarily unavailable" }, 503);
    if (url.pathname.startsWith("/media/")) {
      state.mediaRequests++;
      return intercept.fulfill({ status: 200, contentType: "audio/mpeg", body: fs.readFileSync(path.join(root, "assets/audio/dinner.mp3")) });
    }
    if (url.pathname.includes("/auth/")) return reply(session);
    assert.equal(request.headers().authorization, `Bearer ${session.accessToken}`);
    if (url.pathname.endsWith("/bootstrap")) return reply({ routes: cards(), maxPinnedRoutes: 3, recordsDriveUrl: state.recordsDriveUrl, quickAnnouncements: [
      { id: "welcome-note", name: "Welcome Note", type: "MULTIPLE", audios: audios.slice(0, 2) },
      { id: "dinner-break", name: "Dinner Break", type: "SINGLE", audio: audios[2], audioUrl: audios[2].audioUrl },
      { id: "toilet-break", name: "Toilet Break", type: "SINGLE", audio: audios[3], audioUrl: audios[3].audioUrl },
    ] });
    if (url.pathname.includes("/pinned-routes/")) {
      const id = url.pathname.split("/").pop();
      if (request.method() === "DELETE") pins.delete(id);
      else if (!pins.has(id) && pins.size === 3) return reply({ code: "PIN_LIMIT_REACHED", message: "You can pin up to 3 routes. Unpin a route before pinning another." }, 409);
      else pins.add(id);
      return reply({ routes: cards().filter((route) => route.isPinned), maxPinnedRoutes: 3 });
    }
    if (url.pathname.endsWith("/announcements")) {
      const route = cards().find((item) => url.pathname.includes(`/${item.id}/`));
      return reply({ routeId: route.routeId, route, announcements: [{ ...audios[4], sequence: 1 }, { ...audios[5], sequence: 3 }] });
    }
    if (url.pathname.includes("/audios/")) { state.audioRequests++; return reply(audios.find((item) => url.pathname.endsWith(`/${item.id}`))); }
    if (url.pathname.endsWith("/config")) return reply({ recordsDriveUrl: state.recordsDriveUrl });
    throw new Error(`Unexpected fixture request ${url}`);
  });
  const button = (name) => page.getByRole("button", { name, exact: true });
  const tab = (name) => page.getByRole("tab", { name, exact: true });
  const visible = (text) => page.getByText(text, { exact: true }).and(page.locator(":visible")).first().waitFor({ state: "visible", timeout: 15000 });
  try {
    await page.goto(base);
    await page.getByRole("textbox", { name: "Username", exact: true }).fill("driver");
    await page.getByLabel("Password", { exact: true }).fill("fixture-password");
    await button("Sign in").click();
    await visible("Pinned Routes");
    await button("View Route Announcements").waitFor();
    assert.equal(await page.getByRole("button", { name: /^Unpin / }).count(), 0);
    assert.equal(state.mediaRequests, 0, "Startup must not download any media");
    await page.screenshot({ path: path.join(evidence, "home-empty.png") });
    checks.push("Authenticated startup uses a live catalog, no media downloads, and one route button with no empty cards");
    await button("View Route Announcements").click();
    await visible("0 of 3 routes pinned");
    await visible("Via Vijayawada");
    for (const code of ["ST-A01", "ST-A02", "ST-A03"]) {
      await button(`Pin ${code}`).click();
      await button(`Unpin ${code}`).waitFor();
    }
    assert.equal(await button("Pin ST-A04").isDisabled(), true);
    await tab("Home").click();
    await button("Unpin ST-A01").waitFor();
    assert.equal(await page.getByRole("button", { name: /^Unpin / }).count(), 3);
    assert.equal(await button("View Route Announcements").count(), 0);
    await page.screenshot({ path: path.join(evidence, "home-pinned.png") });
    await button("Unpin ST-A02").click();
    await tab("Audio").click();
    await visible("2 of 3 routes pinned");
    await button("Pin ST-A04").click();
    await button("Unpin ST-A04").waitFor();
    await page.reload();
    await button("Unpin ST-A04").waitFor();
    checks.push("Pin/unpin is shared across Home/Audio, limited to three, and restored from the backend after reload");
    await page.getByRole("button", { name: /^ST-A01,.*Open announcements$/ }).click();
    await visible("1. Starting Point");
    await visible("3. Next Stop");
    await button("Play 3. Next Stop").click();
    await visible("Playing announcement");
    await page.waitForTimeout(500);
    assert.ok(state.audioRequests > 0);
    await button("Go back").click();
    await visible("Playing announcement");
    assert.equal(await button("Open 3. Next Stop").getAttribute("aria-current"), "true");
    await page.screenshot({ path: path.join(evidence, "route-playing.png") });
    await button("Open 3. Next Stop").click();
    await button("Stop announcement").click();
    await button("Go back").click();
    await button("Go back").click();
    await tab("Home").click();
    checks.push("Route audio uses explicit backend sequence (including gaps), streams on tap, and indicates the playing row");
    await button("Choose Welcome Note").click();
    await button("Play Welcome Note 1").waitFor();
    await button("Play Welcome Note 2").click();
    await visible("Playing announcement");
    await page.waitForTimeout(500);
    await button("Stop announcement").click();
    await button("Go back").click();
    await button("Go back").click();
    for (const name of ["Dinner Break", "Toilet Break"]) {
      await button(`Play ${name}`).click();
      await visible("Playing announcement");
      await page.waitForTimeout(500);
      await button("Stop announcement").click();
      await button("Go back").click();
    }
    checks.push("Welcome Note opens multiple audios; Dinner and Toilet play directly without selection screens");
    await tab("Records").click();
    const driveRequest = page.waitForRequest("https://drive.google.com/**");
    await button("Open Google Drive").click();
    assert.equal((await driveRequest).url(), "https://drive.google.com/drive/folders/records-test");
    await page.screenshot({ path: path.join(evidence, "records.png") });
    state.recordsDriveUrl = null;
    await button("Open Google Drive").click();
    await visible("The records folder has not been configured. Please contact your administrator.");
    checks.push("Records opens the latest backend Drive URL and handles missing configuration");
    await tab("Home").click();
    await button("Play Dinner Break").click();
    await visible("Playing announcement");
    await page.waitForTimeout(500);
    await context.setOffline(true);
    await visible("Connection interrupted");
    await context.setOffline(false);
    await button("Go back").click();
    await tab("Audio").click();
    state.fail = true;
    await button("Refresh routes").click();
    await visible("Service temporarily unavailable");
    assert.equal(await page.getByRole("button", { name: /Open announcements$/ }).count(), 0);
    state.fail = false;
    await button("Retry connection").click();
    await button("Unpin ST-A01").waitFor();
    checks.push("Connection loss interrupts streaming; API failure removes stale route data and retry recovers");
    for (const width of [320, 390, 430, 768]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, `Overflow at ${width}px`);
    }
    const storageKeys = await page.evaluate(() => Object.keys(localStorage));
    assert.ok(!storageKeys.some((key) => /library|manifest/.test(key)));
    assert.deepEqual(errors, []);
    checks.push("Responsive route layout has no document overflow; only credentials/preferences persist; no browser runtime errors");
    fs.writeFileSync(path.join(evidence, "browser-check.json"), JSON.stringify({ date: new Date().toISOString(), checks, errors }, null, 2));
    console.log(JSON.stringify({ checks, errors }, null, 2));
  } catch (error) {
    await page.screenshot({ path: path.join(evidence, "failure.png") });
    console.error(await page.locator("body").innerText());
    throw error;
  } finally { await browser.close(); await new Promise((resolve) => server.close(resolve)); }
}
run().catch((error) => { console.error(error); server.close(); process.exitCode = 1; });
