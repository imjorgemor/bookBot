import { chromium } from "playwright";

// Env vars
const { METRO_EMAIL, METRO_PASSWORD, SHEET_URL, PORT } = Bun.env as Record<
  "METRO_EMAIL" | "METRO_PASSWORD" | "SHEET_URL" | "PORT",
  string
>;
const TIMEOUT = 15000;
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
// The club allows bookings up to 72 h ahead. The bot runs the night before 00:00,
// so it books 3 days after that night. Night it runs (23:55) → day it books (sheet row):
//   Monday    → Thursday
//   Tuesday   → Friday
//   Wednesday → Saturday
//   Thursday  → Sunday
//   Friday    → Monday
//   Saturday  → Tuesday
//   Sunday    → Wednesday
const DAYS_AHEAD = 3;
// Book this long after 00:00, in case the club's clock is slightly behind ours
const MIDNIGHT_BUFFER_MS = 250;
// Madrid time to start logging in, close to midnight so the session doesn't sit idle too long
const LOGIN_AT = "23:57:30";
// Not needed to book: skip them to load pages faster
const TRACKERS =
  /tiktok|facebook|google-analytics|googletagmanager|cloudflareinsights|cookieyes|fonts\.googleapis/;
const SKIP_TYPES = ["image", "media", "font"];

// Book one court at hour "HH:MM", daysAhead days after today.
// dryRun: only find the free court, don't wait for midnight or click book.
async function book(hour: string, daysAhead = DAYS_AHEAD, dryRun = false) {
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-gpu", "--disable-dev-shm-usage"], // no GPU; /dev/shm is tiny in Docker
  });
  const page = await browser.newPage();
  await page.route("**/*", (route) => {
    const req = route.request();
    const skip =
      SKIP_TYPES.includes(req.resourceType()) || TRACKERS.test(new URL(req.url()).hostname);
    return skip ? route.abort() : route.continue();
  });
  try {
    // Login (don't wait for the full page load, only for the HTML)
    await page.goto("https://clubmetropolitan.com/socios/login?referer=%2Fsocios%2Fperfil%2F", {
      waitUntil: "domcontentloaded",
    });
    await page.fill("#email", METRO_EMAIL);
    await page.fill("#pwd", METRO_PASSWORD);
    await page.click("#wp-submit");

    // Logged in = the bookings button exists (it's only on the profile page)
    const bookingsBtn = page.locator(".botonarea-item.bookings");
    await bookingsBtn.waitFor({ state: "visible", timeout: TIMEOUT });
    console.log(`Logged in: ${page.url()}`);

    // Cookie banner on the booking site: accept it whenever it shows up (it can cover buttons)
    await page.addLocatorHandler(page.locator("#btnCookiesTodas"), (btn) => btn.click());

    // Go to the booking site (this button carries the session over).
    // Handoff done = the sidebar's "Reserva de pista" menu exists (it's on every booking-site page).
    await bookingsBtn.click();
    await page.locator("#liReservas").waitFor({ state: "attached", timeout: TIMEOUT * 3 });
    // Padel page: don't wait for the full load (it can hang), only for the date field
    await page.goto(
      "https://clubmetropolitan.provis.es/Reservas/ActividadesLibresHorariosZonas?idActividadLibre=137&integration=False&publico=False&idtipoCliente=0",
      { waitUntil: "commit" },
    );
    const dateField = page.locator("#dateAALL");
    await dateField.waitFor({ state: "visible", timeout: TIMEOUT * 2 });
    console.log("On booking paddle page");

    // Date: open the calendar. Its script may not be ready yet, so click until it shows.
    const today = page.locator("td.day.today");
    for (let i = 0; i < 15 && !(await today.isVisible()); i++) {
      await dateField.click({ timeout: TIMEOUT });
      await today.waitFor({ state: "visible", timeout: 2000 }).catch(() => {});
    }
    // Today's cell + daysAhead
    const dayCell = today.locator(`xpath=following::td[${daysAhead}]`);
    const date = await dayCell.getAttribute("data-day", { timeout: TIMEOUT });
    await dayCell.click();
    await page.waitForSelector(".hour-collapse", { timeout: TIMEOUT });
    console.log(`Date selected: ${date}`);

    // Hour: first free court at that hour
    const hourBtn = page
      .locator(`[data-content="${hour}"]:not([disabled]):not(.disabled):visible`)
      .first();
    const pista = await hourBtn.innerHTML({ timeout: TIMEOUT }).then(
      (html) => html.trim(),
      async (err) => {
        // Show what the page has, to tell "no free court" apart from "wrong selector"
        const hours = await page
          .locator("[data-content]")
          .evaluateAll((els) =>
            els.map(
              (el) =>
                `${el.getAttribute("data-content")}${el.matches("[disabled], .disabled") ? " (taken)" : ""}`,
            ),
          );
        console.error(`No free ${hour} button. Hours on page: ${hours.join(", ") || "none"}`);
        throw err;
      },
    );

    if (dryRun) {
      console.log(`Test OK: found free court ${date} ${hour} (${pista}). Not booking.`);
      return;
    }

    // Wait for 00:00 (Madrid) + buffer, to the millisecond. If it's already past midnight, book now.
    const now = new Date();
    const [h, m, s] = now
      .toLocaleTimeString("en-GB", { timeZone: "Europe/Madrid" })
      .split(":")
      .map(Number);
    const msToMidnight = h
      ? (24 * 3600 - (h * 3600 + m! * 60 + s!)) * 1000 - now.getMilliseconds() + MIDNIGHT_BUFFER_MS
      : 0;
    console.log(`Waiting ${(msToMidnight / 1000).toFixed(3)}s until midnight Madrid`);
    await Bun.sleep(msToMidnight);
    console.log(`Booking at ${new Date().toISOString()}`);

    // Book
    await hourBtn.click();
    await page.click("#btnReserva", { timeout: TIMEOUT });
    await page.click("#btnConfirmar", { timeout: TIMEOUT });
    await page.waitForSelector('.swal-text:has-text("Reserva gratuita realizada")', {
      timeout: TIMEOUT,
    });
    console.log(`Booked ${date} ${hour} (${pista})`);
  } catch (err) {
    console.error("Book failed:", err);
    // What the page shows instead (error message, captcha, other URL...)
    const title = await page.title().catch(() => "?");
    const text = await page
      .locator("body")
      .innerText({ timeout: 3000 })
      .catch(() => "");
    console.error(`Failed at: ${page.url()} | title: ${title}`);
    console.error(`Page text: ${text.replace(/\s+/g, " ").slice(0, 1000)}`);
    await page.screenshot({ path: "/tmp/fail.png", fullPage: true }).catch(() => {});
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

// Read the sheet and book tonight's row, if any
async function run() {
  try {
    const today = DAYS.indexOf(
      new Date().toLocaleDateString("en-US", { timeZone: "Europe/Madrid", weekday: "long" }),
    );
    const targetDay = DAYS[(today + DAYS_AHEAD) % 7]!;

    // Sheet rows: day,hour (e.g. Friday,10:00)
    const csv = await (await fetch(SHEET_URL.replace(/\/edit.*$/, "/export?format=csv"))).text();
    const rows = csv
      .trim()
      .split(/\r?\n/)
      .slice(1) // skip header
      .map((line) => {
        const [day = "", hour = ""] = line.split(",").map((cell) => cell.trim());
        return { day, hour };
      });

    const match = rows.find((r) => r.day.toLowerCase() === targetDay.toLowerCase());
    console.log({ rows, match });

    if (!match) return console.log(`Nothing to do: no ${targetDay} row in the sheet`);
    console.log(`Target: ${match.day} at ${match.hour}`);

    // The trigger fires at 23:55, but logging in then leaves the session idle ~4.5 min before 00:00,
    // and the club may expire it. So wait until LOGIN_AT; prep takes ~15-60 s.
    if (isBookingHour()) {
      const now = new Date();
      const [h, m, s] = now
        .toLocaleTimeString("en-GB", { timeZone: "Europe/Madrid" })
        .split(":")
        .map(Number);
      const [lh, lm, ls] = LOGIN_AT.split(":").map(Number);
      const msToLogin = Math.max(
        0,
        (lh! * 3600 + lm! * 60 + ls! - (h! * 3600 + m! * 60 + s!)) * 1000 - now.getMilliseconds(),
      );
      console.log(`Waiting ${(msToLogin / 1000).toFixed(1)}s until ${LOGIN_AT} to log in`);
      await Bun.sleep(msToLogin);
    }
    await book(match.hour);
  } catch (err) {
    console.error("Run failed:", err);
  }
}

// Only book at 23:xx Madrid (the trigger fires at 23:55). Avoids accidental bookings.
function isBookingHour() {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
  return hour === "23";
}

// Test: log in and find a free court tomorrow at 07:00 (usually free), without booking
const TEST_HOUR = "07:00";
const test = () => book(TEST_HOUR, 1, true);

// --now: run once locally (skips the hour check), then exit
if (Bun.argv.includes("--now")) {
  await run();
  process.exit();
}
// --test: run the test locally, then exit
if (Bun.argv.includes("--test")) {
  await test();
  process.exit();
}

// Server: an outside timer calls GET /book at 23:55 Madrid.
// The request wakes the service (Railway serverless), we answer at once and book in the background.
let running = false;
Bun.serve({
  port: Number(PORT) || 3000,
  routes: {
    "/book": () => {
      if (!isBookingHour()) return new Response("Skip: not 23:xx in Madrid");
      if (running) return new Response("Already running");

      running = true;
      // Safety: if a run hangs for 20 min, exit (Railway restarts us) so the next night isn't blocked
      const killer = setTimeout(() => process.exit(1), 20 * 60 * 1000);
      run().finally(() => {
        clearTimeout(killer);
        running = false;
      });
      return new Response("Started");
    },
    // Test on demand (check the logs for "Test OK")
    "/test": () => {
      if (running) return new Response("Already running");
      running = true;
      test().finally(() => (running = false));
      return new Response("Test started");
    },
  },
  fetch: () => new Response("OK"), // anything else: health check
});
console.log(`Listening on port ${Number(PORT) || 3000}`);

// TEST_ON_START=1: run the test on every boot (so each deploy checks itself). Remove it after.
if (Bun.env.TEST_ON_START && !running) {
  running = true;
  test().finally(() => (running = false));
}
