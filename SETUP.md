# bookBot setup guide

This bot books a padel court at Club. Every night at 00:00 (Madrid time) the club opens bookings for the day 3 days ahead. The bot is already logged in and waiting, so it grabs your court the second it opens.

You tell it what to book in a Google Sheet: one row per weekday, with the hour you want to play.

It runs for free in the cloud. Your computer doesn't need to stay on.

**Start here (human):** open Claude Code Desktop and paste the prompt from [PROMPT.md](PROMPT.md). Claude downloads the code and guides you. (Or download the ZIP from https://github.com/imjorgemor/bookBot, unzip it, open the `bookBot-main` folder in Claude Code Desktop and write **"help me set up the bot"**.)

> 🤖 If you were started from PROMPT.md, run every command below from inside the `bookBot-main` folder.

---

## For Claude (the agent guiding the setup)

You are helping a **non-technical person**. Rules:

- **Speak their language** (probably Spanish), keep it short and friendly, no jargon.
- **Do everything you can yourself** (🤖 steps). Only ask the human for what needs their own login or clicks (👤 steps). One 👤 step at a time.
- **Never assume a 👤 step is done.** After each one, ask explicitly ("Have you created the cron-job.org job? What does Test run show?") and wait for a clear yes. Where you can, verify it yourself (sheet CSV, `railway variables`, `railway whoami`, `/test` logs). Steps you can't verify, like the password, Serverless and the timer, need their explicit confirmation. A skipped 👤 step fails silently: e.g. without the timer the bot just never books.
- **Before saying the setup is finished,** go through every 👤 step with them and get a yes for each: sheet shared, Railway account, `METRO_PASSWORD` added, Serverless ON, cron-job.org job created at 23:55 Europe/Madrid with Test run = `Skip`.
- **Never ask for their Club password in the chat.** They type it into Railway themselves (step 3).
- Don't change the code in `src/`. The booking flow works. If something fails, see Troubleshooting.
- If they come back after a break, show a short checklist of what's done.

Values you'll collect (none are secret): `SHEET_URL` (step 1), their Club login email (step 2), `APP_URL` (step 2).

---

## Step 1: The booking sheet 👤 + 🤖

1. 👤 Open this link and click **Make a copy**:
   https://docs.google.com/spreadsheets/d/1-jL92G27T2p8ilznOEIMTnUYsWyRunblfu_AQ6UcWLk/copy
2. 👤 In the copy, keep one row per day you want to play (delete the others):
   - **Column A:** the day you want to **play**, in English (`Monday` … `Sunday`). Use the dropdown.
   - **Column B:** the hour, 24-hour with two digits: `07:00`, `10:00`, `17:00` (5 pm = `17:00`). Use the dropdown.
3. 👤 **Share** (top right) → **General access** → **Anyone with the link** → **Viewer** → **Copy link** → paste it in the chat.
4. 🤖 Check it reads correctly (replace everything from `/edit` with `/export?format=csv`):
   ```sh
   curl -sL "https://docs.google.com/spreadsheets/d/<SHEET_ID>/export?format=csv"
   ```
   Expect a header and lines like `Friday,10:00`. A sign-in or HTML page means sharing isn't "Anyone with the link". If hours show as `7:00`, ask them to select column B → **Format → Number → Plain text** and retype them.

---

## Step 2: Create the bot on Railway 👤 + 🤖

Railway is the cloud service that runs the bot.

1. 👤 Create an account at https://railway.com (Google or email login is fine). Pick the free plan or trial. If Railway asks for anything unexpected, tell Claude.
2. 🤖 Install the Railway command-line tool (no Node or Bun needed):
   ```sh
   bash <(curl -fsSL cli.new)
   ```
   If that fails and `brew` exists, use `brew install railway`. Check with `railway --version`.
3. 🤖 + 👤 Log in. Run this in the background, show the human the link and code it prints, and ask them to open the link and approve:
   ```sh
   railway login --browserless
   ```
   Confirm with `railway whoami`.
4. 🤖 Create the project and the service (ask the human for their Club login email first):
   ```sh
   railway init --name bookbot
   railway add --service bookbot
   railway variables --service bookbot --set "METRO_EMAIL=<their email>" --set "SHEET_URL=<SHEET_URL>"
   railway domain --service bookbot --port 8080
   ```
   If a command asks a question (e.g. which workspace), pick the only/default option. If `--port` isn't accepted, run `railway domain --service bookbot` without it. The domain printed is `APP_URL` (e.g. `https://bookbot-production-xxxx.up.railway.app`).

---

## Step 3: Password and sleep mode 👤

One visit to the Railway dashboard (🤖 you can open it with `railway open`):

1. Click the **bookbot** box → **Variables** → **+ New Variable**:
   - Name: `METRO_PASSWORD`
   - Value: your Club password. No quotes, no spaces.
   - Click **Add**. If a banner appears with **Deploy** / **Apply changes**, click it.
2. Same box → **Settings** → **Serverless** → make sure it's **ON** (the free plan requires it). The bot sleeps when idle and wakes when the nightly timer calls it.

---

## Step 4: Deploy and test 🤖

1. Upload the code (Railway builds it, 2–4 minutes):
   ```sh
   railway up --service bookbot --detach
   railway deployment list --service bookbot
   ```
   Repeat the second command every ~30 s until the top deployment is `SUCCESS`.
2. Wake it, then run the test. The test logs in, opens tomorrow's padel page and looks for a free court at 07:00. It **never books**:
   ```sh
   curl -s "$APP_URL/"        # expect OK (first call can take ~20 s)
   curl -s "$APP_URL/test"    # expect: Test started
   ```
   If `/test` answers `OK` instead of `Test started`, the new version isn't live yet. Wait a minute and retry.
3. Wait ~40 s and read the logs yourself:
   ```sh
   railway logs --service bookbot --lines 30
   ```
   Success looks like:
   ```
   Logged in: https://clubmetropolitan.com/socios/perfil/
   On booking paddle page
   Date selected: 18/11/2026
   Test OK: found free court 18/11/2026 07:00 (PISTA PADEL 3). Not booking.
   ```
   Anything else → Troubleshooting.

---

## Step 5: The nightly timer 👤

The bot sleeps all day (Serverless), and **nothing on Railway can wake it at a set time**. Railway's own cron doesn't work with Serverless on the free plan. An outside timer has to call it every night at 23:55. cron-job.org does that for free. Without this step, **nothing is ever booked**.

1. Create an account at https://cron-job.org and confirm your email.
2. **Create cronjob**:
   - **Title:** `bookBot`
   - **URL:** `APP_URL/book` (🤖 give them the exact URL to copy)
   - **Schedule:** every day at **23:55**
   - **Time zone:** **Europe/Madrid**
   - Save.
3. Click **Test run** (**not between 23:00 and 23:59**: at that hour it would start the real booking). The response should be `Skip: not 23:xx in Madrid`. That's correct: the timer reaches the bot, and the bot only books when called between 23:00 and 23:59 Madrid time.
4. 🤖 The next morning, check that the timer really fired: `railway logs --service bookbot --lines 50` should show `Target: …` (or `Nothing to do: …`) around 23:55. If it only shows `Starting Container` / `Stopping Container` with no `Target` line, the timer isn't calling `/book`.

---

## Done 🎉

- **23:55:** the timer wakes the bot. It checks the sheet for the day 4 days later (Monday night → Friday).
- If there's a row, at **23:57:30** it logs in, finds the first free court at that hour, and waits (logging in later keeps the session fresh).
- **00:00:** it books. You get the club's usual confirmation.
- **To change what it books, just edit the sheet.**

To check a night's result, ask Claude in this folder: "did last night's booking work?" (🤖 run `railway logs --service bookbot --lines 50` and look for `Booked …`).

To test any time, open `APP_URL/test` in the browser and ask Claude to check the logs.

---

## Troubleshooting (for Claude)

Read the logs with `railway logs --service bookbot --lines 50`.

| Log line | Meaning | Fix |
|---|---|---|
| `Test OK: …` / `Booked …` | Works | - |
| `Nothing to do: no Friday row in the sheet` | No row for that day | Normal if they don't play that day |
| `No free 07:00 button. Hours on page: …` | That hour is taken (the page only lists free hours) | Not a bug. For bookings, pick an hour that's usually free |
| `.botonarea-item.bookings` timeout + `Page text: …` | Login failed | Read `Page text`. Usually a wrong email/password in Variables (typo, space, quotes). Fix in the dashboard, then test again |
| `#dateAACC` timeout | Club site slow | Run the test again |
| `Run failed` / CSV errors | Can't read the sheet | Check sharing and `SHEET_URL` (`railway variables --service bookbot`) |
| `/test` returns `OK` | Old version still running | Wait. If a new deployment stays stuck, remove the old **Active** one in the dashboard (deployment → **⋮** → **Remove**) and call `APP_URL/` |
| `Already running` | A test or booking is running | Wait 1 minute |
| `Stopping Container` before 00:00 | Slept mid-run | Check the timer is 23:55, Europe/Madrid |

Never set a `TEST_ON_START` variable: it makes the nightly booking skip. Use `APP_URL/test`.

**Code updates:** download the new ZIP, unzip, open it in Claude Code, then run `railway link --project bookbot --service bookbot` and `railway up --service bookbot --detach`, and test again.

**Already have GitHub?** Instead of the ZIP and `railway up`, you can fork the repo and in Railway use **New Project → Deploy from GitHub repo**. Then set the same three variables, generate a domain (port 8080), turn on Serverless, and continue from Step 4.2.
