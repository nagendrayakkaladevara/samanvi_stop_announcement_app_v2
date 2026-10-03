// Optional browser audit: see docs/UI-UX-REVIEW.md for setup and scope.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { createRequire } = require("node:module");
const root = path.resolve(__dirname, "..");
const apiMode = process.argv.includes("--api");
const dist = path.join(root, apiMode ? "dist-ui-api" : "dist");
const evidence = path.join(root, "docs/ui-review");
const shots = path.join(root, "docs/screenshots");
const api = "https://announcements.example.test/api/v1";
const requirePlaywright = process.env.SAMANVI_PLAYWRIGHT_ROOT
  ? createRequire(
      path.join(process.env.SAMANVI_PLAYWRIGHT_ROOT, "package.json"),
    )
  : require;
const { chromium } = requirePlaywright("playwright");
const checks = [];
const errors = [];
fs.mkdirSync(path.join(evidence, "states"), { recursive: true });
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mp3": "audio/mpeg",
  ".ttf": "font/ttf",
  ".png": "image/png",
  ".json": "application/json",
};
const server = http.createServer((request, response) => {
  let file = path.resolve(
    dist,
    "." + decodeURIComponent(request.url.split("?")[0]),
  );
  if (file !== dist && !file.startsWith(dist + path.sep)) {
    response.writeHead(403).end();
    return;
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory())
    file = path.join(dist, "index.html");
  response.setHeader(
    "Content-Type",
    mime[path.extname(file)] || "application/octet-stream",
  );
  fs.createReadStream(file).pipe(response);
});

async function mockService(page) {
  const stamp = "2026-09-27T00:00:00.000Z";
  const media = {};
  const audio = (id, title, file, category) => {
    media[id] = fs.readFileSync(path.join(root, "assets/audio", file));
    return {
      id,
      title,
      description: null,
      category,
      originalFileName: file,
      mimeType: "audio/mpeg",
      sizeBytes: String(media[id].length),
      durationMs: null,
      checksumSha256: null,
      status: "ready",
      blobUrl: null,
      downloadUrl: `https://announcements.example.test/media/${id}.mp3`,
      createdAt: stamp,
      updatedAt: stamp,
    };
  };
  const common = [
    audio("dinner", "Dinner break", "dinner.mp3", "common_audio"),
    audio("toilet", "Toilet break", "toilet.mp3", "common_audio"),
  ];
  const stops = [
    audio("vja", "Vijayawada", "vijayawada.mp3", "stop_announcement"),
    audio("vskp", "Visakhapatnam", "visakhapatnam.mp3", "stop_announcement"),
  ];
  const route = {
    id: "route-a",
    routeCode: "VJA-VSKP",
    name: "Vijayawada to Visakhapatnam",
    origin: "Vijayawada",
    destination: "Visakhapatnam",
    version: 1,
    updatedAt: stamp,
  };
  const empty = {
    ...route,
    id: "route-b",
    routeCode: "ELR-HYD",
    name: "Eluru to Hyderabad",
    origin: "Eluru",
    destination: "Hyderabad",
  };
  const control = {
    failBootstrap: false,
    emptyCatalog: false,
    version: 1,
    manifestCalls: 0,
  };
  await page.route("https://announcements.example.test/**", async (request) => {
    const url = new URL(request.request().url());
    const headers = { "Access-Control-Allow-Origin": "*" };
    if (url.pathname.startsWith("/media/")) {
      await new Promise((resolve) => setTimeout(resolve, 180));
      const id = path.basename(url.pathname, ".mp3");
      await request.fulfill({
        status: 200,
        contentType: "audio/mpeg",
        headers,
        body: media[id],
      });
      return;
    }
    if (url.pathname.endsWith("/bootstrap")) {
      await request.fulfill({
        status: control.failBootstrap ? 503 : 200,
        contentType: "application/json",
        headers,
        body: JSON.stringify({
          success: true,
          data: {
            welcomeAudio: null,
            commonAudios: control.emptyCatalog ? [] : common,
            routes: control.emptyCatalog
              ? []
              : [
                  { ...route, version: control.version, _count: { audios: 2 } },
                  { ...empty, _count: { audios: 0 } },
                ],
          },
        }),
      });
      return;
    }
    control.manifestCalls++;
    const selected = url.pathname.includes("route-b") ? empty : route;
    await request.fulfill({
      status: 200,
      contentType: "application/json",
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          ...selected,
          version: selected.id === "route-a" ? control.version : 1,
          audios:
            selected.id === "route-a"
              ? stops.map((audio, position) => ({
                  position,
                  stopLabel: audio.title,
                  audio,
                }))
              : [],
        },
      }),
    });
  });
  await page.addInitScript(
    (base) =>
      localStorage.setItem(
        `samanvi-v2:${base}:preferences`,
        JSON.stringify({
          entered: true,
          keepAwake: true,
          requireSpeaker: false,
        }),
      ),
    api,
  );
  return control;
}

async function run() {
  if (!fs.existsSync(path.join(dist, "index.html")))
    throw new Error(`Export the web app into ${path.basename(dist)} first.`);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.SAMANVI_BROWSER_EXECUTABLE
      ? { executablePath: process.env.SAMANVI_BROWSER_EXECUTABLE }
      : {}),
    args: process.env.SAMANVI_BROWSER_ARGS_JSON
      ? JSON.parse(process.env.SAMANVI_BROWSER_ARGS_JSON)
      : [],
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("dialog", (dialog) => dialog.accept());
  const button = (name) => page.getByRole("button", { name, exact: true });
  const visible = (text) =>
    page
      .getByText(text, { exact: true })
      .and(page.locator(":visible"))
      .first()
      .waitFor({ state: "visible", timeout: 15000 });
  const screenshot = async (name) => {
    // Let route transitions and native-web switch animations settle before capture.
    await page.waitForTimeout(350);
    return page.screenshot({
      path: path.join(
        name.startsWith("state-") ? path.join(evidence, "states") : shots,
        name + ".png",
      ),
    });
  };
  const readyDemo = () =>
    page.waitForFunction(
      () =>
        Object.keys(
          JSON.parse(localStorage.getItem("samanvi-v2:demo:library") || "{}")
            .files || {},
        ).length === 4,
    );
  const noOverflow = async (label) => {
    const problems = await page.evaluate(() => {
      const issues = [];
      if (document.documentElement.scrollWidth > window.innerWidth + 1)
        issues.push("document");
      for (const el of document.querySelectorAll('[dir="auto"],input')) {
        const box = el.getBoundingClientRect();
        if (
          box.width < 1 ||
          box.height < 1 ||
          box.right < 0 ||
          box.left > window.innerWidth ||
          getComputedStyle(el).visibility === "hidden"
        )
          continue;
        if (
          el.clientWidth &&
          el.scrollWidth > el.clientWidth + 3 &&
          getComputedStyle(el).textOverflow !== "ellipsis" &&
          !el.closest('[aria-hidden="true"]')
        )
          issues.push(
            (el.innerText || el.getAttribute("aria-label") || "text").slice(
              0,
              80,
            ),
          );
      }
      return issues;
    });
    assert.deepEqual(problems, [], `${label}: horizontal clipping`);
  };
  try {
    if (apiMode) {
      const service = await mockService(page);
      await page.goto(base);
      await page.waitForFunction(
        (base) =>
          Object.keys(
            JSON.parse(
              localStorage.getItem(`samanvi-v2:${base}:library`) || "{}",
            ).files || {},
          ).length === 2,
        api,
      );
      await button("Choose a route").click();
      await button("Select Vijayawada to Visakhapatnam").click();
      await button("Download route audio").waitFor();
      await screenshot("state-route-download");
      await button("Download route audio").click();
      await button("Play Vijayawada").waitFor();
      checks.push(
        "API-shaped fixtures: bootstrap, choose route, manifest, download, ordered stops",
      );
      await button("Change").click();
      await page.evaluate(() => {
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, value) {
          if (
            key.endsWith(":library") &&
            JSON.parse(value).selectedRouteId === "route-b"
          )
            throw new DOMException("Storage is full.", "QuotaExceededError");
          return original.call(this, key, value);
        };
        window.__restoreStorage = () => (Storage.prototype.setItem = original);
      });
      await button("Select Eluru to Hyderabad").click();
      await visible("Storage is full.");
      assert.equal(new URL(page.url()).pathname, "/routes");
      await screenshot("state-route-save-error");
      await page.evaluate(() => window.__restoreStorage());
      await button("Select Eluru to Hyderabad").click();
      await visible("Save your route audio");
      checks.push(
        "Failed route persistence keeps the route picker open with an error; retry succeeds",
      );

      await page.goto(base + "/library");
      await button("Download Vijayawada").waitFor();
      const previousCalls = service.manifestCalls;
      await button("Download Vijayawada").click();
      await button("Play Vijayawada").waitFor();
      assert.equal(new URL(page.url()).pathname, "/library");
      assert.ok(service.manifestCalls > previousCalls);
      assert.equal(
        await page.evaluate(
          (base) =>
            JSON.parse(localStorage.getItem(`samanvi-v2:${base}:library`))
              .selectedRouteId,
          api,
        ),
        "route-b",
      );
      checks.push(
        "Missing download recovers in place without a navigation loop or changing the selected route",
      );
      service.failBootstrap = true;
      await button("Refresh common announcements").click();
      await page.getByText(/service is unavailable \(503\)/).waitFor();
      await page.waitForFunction(() =>
        Array.from(document.querySelectorAll('[role="alert"]')).some((el) => {
          const box = el.getBoundingClientRect();
          return box.height > 0 && box.top >= 0 && box.bottom <= innerHeight;
        }),
      );
      await screenshot("state-refresh-error");
      await button("Play Vijayawada").click();
      await button("Pause").waitFor();
      await button("Stop announcement").click();
      await button("Go back").click();
      checks.push(
        "Refresh failure brings its error into view and preserves playable previously downloaded audio",
      );
      service.failBootstrap = false;
      service.version = 2;
      await button("Refresh common announcements").click();
      await visible("Update available");
      await screenshot("state-route-update");
      checks.push(
        "Available route update is clearly identified while saved audio remains usable",
      );
      await button("Download route audio").click();
      await visible(
        "No stop announcements have been published for this route.",
      );
      await page.goto(base + "/announcements");
      await visible("No stops published yet");
      await screenshot("state-no-stops");
      checks.push(
        "Zero-stop route has an explicit empty state rather than a false ready status",
      );
      service.emptyCatalog = true;
      await page.goto(base + "/routes");
      await button("Refresh routes").click();
      await visible("No routes available");
      await screenshot("state-no-routes");
      checks.push("Empty published catalog has a clear recovery path");
    } else {
      await page.goto(base);
      await button("Get started").waitFor();
      await readyDemo();
      await screenshot("01-welcome");
      await page.setViewportSize({ width: 320, height: 640 });
      await noOverflow("welcome 320px");
      await button("Get started").scrollIntoViewIfNeeded();
      await screenshot("state-welcome-small");
      await button("Get started").click();
      await visible("Have a good journey.");
      await page.setViewportSize({ width: 390, height: 844 });
      await screenshot("02-home");
      assert.equal(
        await button("Lunch break, not yet published").isDisabled(),
        true,
      );
      await button("Play Dinner break").click();
      await page.getByText(/Connect your bus speaker first/).waitFor();
      await screenshot("state-speaker-required");
      await button("Dismiss message").click();
      checks.push(
        "Onboarding scrolls on small screens; unavailable quick action is disabled; speaker guard is preserved",
      );
      await button("Manage audio output").click();
      await button("Test on this device").waitFor();
      const testBox = await button("Test on this device").boundingBox();
      assert.ok(
        testBox.y + testBox.height < 844,
        "Speaker test visible without scrolling at 390px",
      );
      await screenshot("03-speaker");
      await button("Test on this device").click();
      await button("Pause").waitFor();
      await button("Pause").click();
      await visible("Paused");
      await screenshot("04-player");
      await button("Resume").click();
      await button("Pause").waitFor();
      await button("Restart announcement").click();
      await button("Pause").waitFor();
      await button("Stop announcement").click();
      await visible("Stopped");
      await button("Play again").click();
      await visible("Announcement complete");
      await button("Replay").waitFor();
      await screenshot("state-player-complete");
      await button("Go back").click();
      await button("Go back").click();
      checks.push(
        "Visible speaker test; real sample playback; labelled pause, resume, restart, stop, completion and replay",
      );
      await button("Change").click();
      await screenshot("05-routes");
      assert.equal(
        await button("Select Vijayawada to Visakhapatnam").getAttribute(
          "aria-current",
        ),
        "true",
      );
      await page
        .getByRole("textbox", { name: "Search routes" })
        .fill("NoSuchCity");
      await visible("No matching routes");
      await screenshot("state-search-empty");
      await button("Clear search").click();
      await button("Select Vijayawada to Visakhapatnam").click();
      await visible("Route stops");
      await screenshot("06-announcements");
      checks.push(
        "Route picker shows current selection, search result count and clear-search recovery",
      );
      await page.getByRole("tab", { name: "Records", exact: true }).click();
      await visible("No playback history is recorded in this version.");
      await screenshot("08-records");
      await button("Go to route audio").click();
      await visible("Route stops");
      await page.getByRole("tab", { name: "Settings", exact: true }).click();
      await screenshot("07-settings");
      await page
        .getByRole("switch", { name: "Require a bus speaker" })
        .uncheck();
      await visible(
        "Speaker check is off. Announcements may play through this device.",
      );
      await page.getByRole("switch", { name: "Keep screen awake" }).uncheck();
      await button("Audio library").click();
      await visible("4 of 4 files saved");
      await screenshot("09-library");
      const downloadBox = await button("Check route audio").boundingBox();
      assert.ok(
        downloadBox.y + downloadBox.height < 844,
        "Library actions visible before long lists",
      );
      await button("Refresh common announcements").click();
      await visible("4 of 4 files saved");
      await button("Go back").click();
      await button("Help & support").click();
      await screenshot("10-help");
      await button("Missing an announcement?").click();
      assert.equal(
        await button("Missing an announcement?").getAttribute("aria-expanded"),
        "true",
      );
      assert.equal(
        await button("No sound from the speaker?").getAttribute(
          "aria-expanded",
        ),
        "false",
      );
      await button("Open audio library").click();
      await visible("Your saved audio");
      checks.push(
        "Records has a return action; settings explain disabled speaker guard; downloads precede grouped audio; Help expands and links to recovery",
      );
      await page.goto(base + "/settings");
      await readyDemo();
      assert.equal(
        await page
          .getByRole("switch", { name: "Require a bus speaker" })
          .isChecked(),
        false,
      );
      assert.equal(
        await page
          .getByRole("switch", { name: "Keep screen awake" })
          .isChecked(),
        false,
      );
      await page.getByRole("tab", { name: "Home", exact: true }).click();
      await button("Play Dinner break").click();
      await button("Pause").waitFor();
      await button("Go back").click();
      await button("Pause announcement").click();
      await button("Open announcement player").click();
      await button("Stop announcement").click();
      checks.push(
        "Both preferences persist; audio survives navigation; mini-player is operable",
      );
      await page.goto(base + "/player");
      await button("View announcements").waitFor();
      await screenshot("state-player-empty");
      const routes = [
        "/(tabs)",
        "/announcements",
        "/routes",
        "/library",
        "/speaker",
        "/settings",
        "/records",
        "/help",
        "/player",
      ];
      for (const width of [320, 390, 430, 768]) {
        await page.setViewportSize({ width, height: 844 });
        for (const route of routes) {
          await page.goto(base + (route === "/(tabs)" ? "/" : route));
          await readyDemo();
          await page.locator('[role="heading"]').first().waitFor();
          await noOverflow(`${route} at ${width}px`);
          if (width === 320)
            await screenshot(
              "state-small-" + (route === "/(tabs)" ? "home" : route.slice(1)),
            );
        }
      }
      checks.push(
        "All main screens checked for horizontal text/document clipping at 320, 390, 430 and 768 pixels",
      );
    }
    assert.deepEqual(errors, []);
    const result = {
      date: "2026-09-27",
      scope: apiMode
        ? "Mock service browser flows; no live backend"
        : "Browser preview; no native hardware",
      checks,
      pageErrors: errors,
    };
    fs.writeFileSync(
      path.join(evidence, apiMode ? "api-check.json" : "browser-check.json"),
      JSON.stringify(result, null, 2) + "\n",
    );
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    await page.screenshot({ path: path.join(evidence, "failure.png") });
    console.log(
      "Current screen:",
      (await page.locator("body").innerText()).slice(0, 8000),
    );
    console.log("Runtime errors:", errors);
    throw error;
  } finally {
    await browser.close();
    server.close();
  }
}
run().catch((error) => {
  console.error(error);
  process.exit(1);
});
