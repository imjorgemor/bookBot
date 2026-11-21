import { chromium } from "playwright";

// Env vars. Each user's login is METRO_EMAIL_<n> / METRO_PASSWORD_<n>, n from the sheet ("jorge - 3").
const { SHEET_URL, PORT } = Bun.env as Record<"SHEET_URL" | "PORT", string>;
const TIMEOUT = 15000;
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
// The club opens each court exactly 72 h (3 days) before it starts: Sunday 13:00 opens Thursday 13:00.
// cron-job.org calls /book every hour at :57; the bot books the sheet rows whose court opens at the next :00.
const OPENS_DAYS_BEFORE = 3;
// Courts start at :00 and :30, so they also open at :00 and :30 (a :30 row needs a trigger at :27)
const SLOT_MINUTES = 30;
// Click this long after the court opens, in case the club's clock is slightly behind ours
const OPEN_BUFFER_MS = 250;
// Start logging in this long before the court opens, so the session doesn't sit idle (prep takes ~15-60 s)
const LOGIN_BEFORE_MS = 150_000;
// Only book when called at most this long before a court opens. Avoids accidental bookings.
const MAX_WAIT_MS = 10 * 60_000;
// Not needed to book: skip them to load pages faster
const TRACKERS =
  /tiktok|facebook|google-analytics|googletagmanager|cloudflareinsights|cookieyes|fonts\.googleapis/;
const SKIP_TYPES = ["image", "media", "font"];

type Login = { email: string; password: string };

// Book one court at hour "HH:MM", daysAhead days after today, clicking when it opens (opensAt, ms timestamp).
// Without opensAt it's a dry run: only find the free court, never book.
async function book(login: Login, hour: string, daysAhead: number, opensAt?: number) {
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
    await page.fill("#email", login.email);
    await page.fill("#pwd", login.password);
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

    if (opensAt === undefined) {
      console.log(`Test OK: found free court ${date} ${hour} (${pista}). Not booking.`);
      return;
    }

    // Wait until the court opens + buffer, to the millisecond. If it's already open, book now.
    const msToOpen = Math.max(0, opensAt + OPEN_BUFFER_MS - Date.now());
    console.log(
      `Waiting ${(msToOpen / 1000).toFixed(3)}s until it opens at ${madridTime(opensAt)}`,
    );
    await Bun.sleep(msToOpen);
    console.log(`Booking at ${madridTime(Date.now())} Madrid`);

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

// Madrid wall-clock parts of time t (ms timestamp)
function madridParts(t: number) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  }).formatToParts(t);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

// "12:57:30.250" in Madrid time
function madridTime(t: number) {
  return new Date(t).toLocaleTimeString("en-GB", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    fractionalSecondDigits: 3,
  });
}

const pad = (n: number) => String(n).padStart(2, "0");

// The next court opening after now: when it opens (opensAt) and the court it opens (day + hour,
// 3 days later). E.g. called Thursday 12:57 → opens Thursday 13:00, court Sunday 13:00.
function nextOpening(now = Date.now()) {
  const m = madridParts(now);
  const secOfDay = m.hour * 3600 + m.minute * 60 + m.second;
  const openSec = (Math.floor(secOfDay / (SLOT_MINUTES * 60)) + 1) * SLOT_MINUTES * 60;
  const opensAt = now - (now % 1000) + (openSec - secOfDay) * 1000;
  // Same clock time, 3 days later (date math on a UTC date, so month ends roll over correctly)
  const court = new Date(Date.UTC(m.year, m.month - 1, m.day + OPENS_DAYS_BEFORE) + openSec * 1000);
  return {
    opensAt,
    day: DAYS[court.getUTCDay()]!,
    hour: `${pad(court.getUTCHours())}:${pad(court.getUTCMinutes())}`,
    // Calendar days from today: 3, or 4 when it opens at 00:00 tomorrow
    daysAhead: OPENS_DAYS_BEFORE + (openSec >= 24 * 3600 ? 1 : 0),
  };
}

// User "jorge - 3" → METRO_EMAIL_3 / METRO_PASSWORD_3
function loginFor(user: string): Login {
  const n = user.split("-").pop()!.trim();
  const email = Bun.env[`METRO_EMAIL_${n}`];
  const password = Bun.env[`METRO_PASSWORD_${n}`];
  if (!email || !password) {
    throw new Error(`Missing METRO_EMAIL_${n} or METRO_PASSWORD_${n} in Railway Variables`);
  }
  return { email, password };
}

// Sheet rows: user,day,hour (e.g. "jorge - 3,Sunday,13:00")
async function readSheet() {
  const csv = await (await fetch(SHEET_URL.replace(/\/edit.*$/, "/export?format=csv"))).text();
  return csv
    .trim()
    .split(/\r?\n/)
    .slice(1) // skip header
    .map((line) => {
      const [user = "", day = "", hour = ""] = line.split(",").map((cell) => cell.trim());
      return { user, day, hour: hour.padStart(5, "0") }; // "7:00" → "07:00"
    });
}

// Book the sheet rows whose court opens next, if any
async function run() {
  try {
    const next = nextOpening();
    const rows = await readSheet();
    const matches = rows.filter(
      (r) => r.day.toLowerCase() === next.day.toLowerCase() && r.hour === next.hour,
    );
    console.log({ rows, matches });

    if (!matches.length) {
      return console.log(`Nothing to do: no ${next.day} ${next.hour} row in the sheet`);
    }
    for (const r of matches) {
      console.log(`Target: ${r.user}, ${r.day} at ${r.hour} (opens ${madridTime(next.opensAt)})`);
    }

    // Logging in right away could leave the session idle for minutes before the court opens,
    // and the club may expire it. So wait until LOGIN_BEFORE_MS before it opens.
    const msToLogin = next.opensAt - LOGIN_BEFORE_MS - Date.now();
    if (msToLogin > 0) {
      console.log(`Waiting ${(msToLogin / 1000).toFixed(1)}s to log in`);
      await Bun.sleep(msToLogin);
    }

    // Normally one row. If several users want the same court time, book them all at once.
    await Promise.all(
      matches.map(async (r) => {
        try {
          await book(loginFor(r.user), r.hour, next.daysAhead, next.opensAt);
        } catch (err) {
          console.error(`Book failed for ${r.user}:`, err);
        }
      }),
    );
  } catch (err) {
    console.error("Run failed:", err);
  }
}

// Only book when a court opens within MAX_WAIT_MS (the trigger fires at :57). Avoids accidental bookings.
function isJustBeforeOpening() {
  return nextOpening().opensAt - Date.now() <= MAX_WAIT_MS;
}

// Test: log in as user n and find a free court tomorrow at 07:00 (usually free), without booking
const TEST_HOUR = "07:00";
const test = async (n: string) => {
  try {
    await book(loginFor(n), TEST_HOUR, 1);
  } catch (err) {
    console.error("Test failed:", err);
  }
};

// --now: run once locally (skips the time check), then exit
if (Bun.argv.includes("--now")) {
  await run();
  process.exit();
}
// --test <n>: run the test locally as user n, then exit
if (Bun.argv.includes("--test")) {
  await test(Bun.argv[Bun.argv.indexOf("--test") + 1] ?? "");
  process.exit();
}

// Server: an outside timer calls GET /book every hour at :57 Madrid.
// The request wakes the service (Railway serverless), we answer at once and book in the background.
let running = false;
Bun.serve({
  port: Number(PORT) || 3000,
  routes: {
    "/book": () => {
      if (!isJustBeforeOpening()) return new Response("Skip: no court opens in the next 10 min");
      if (running) return new Response("Already running");

      running = true;
      // Safety: if a run hangs for 20 min, exit (Railway restarts us) so the next hour isn't blocked
      const killer = setTimeout(() => process.exit(1), 20 * 60 * 1000);
      run().finally(() => {
        clearTimeout(killer);
        running = false;
      });
      return new Response("Started");
    },
    // Test on demand as user n: /test?user=3 (check the logs for "Test OK")
    "/test": (req) => {
      const n = new URL(req.url).searchParams.get("user") ?? "";
      try {
        loginFor(n);
      } catch (err) {
        return new Response(`${(err as Error).message}. Use /test?user=<n>`);
      }
      if (running) return new Response("Already running");
      running = true;
      test(n).finally(() => (running = false));
      return new Response(`Test started for user ${n}`);
    },
  },
  fetch: () => new Response("OK"), // anything else: health check
});
console.log(`Listening on port ${Number(PORT) || 3000}`);

// TEST_ON_START=<n>: run the test as user n on every boot (so each deploy checks itself). Remove it after.
if (Bun.env.TEST_ON_START && !running) {
  running = true;
  test(Bun.env.TEST_ON_START).finally(() => (running = false));
}
