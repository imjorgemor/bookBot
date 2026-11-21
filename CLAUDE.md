# bookBot

**If the user wants to set up, configure, test or deploy this bot, follow `SETUP.md` step by step.** They are probably non-technical.

Books padel courts at Club for several users. The club opens each court exactly 72 h before it starts (Sunday 13:00 opens Thursday 13:00). All code is in `src/index.ts`: a `Bun.serve()` server on Railway (Serverless), woken by a cron-job.org call to `GET /book` every hour at :57 Madrid. It reads `user,day,hour` rows from a Google Sheet (CSV export, user like `jorge - 3`), picks the rows whose court opens at the next :00, and uses Playwright (headless Chromium) to log in as that user, wait until it opens and book.

How a sheet row is booked (cron-job.org expression `57 * * * *`, time zone Europe/Madrid):

| Sheet row (court to play) | Bot called (`/book`) | Logs in | Court opens (72 h before) | Bot clicks (+250 ms buffer) |
|---|---|---|---|---|
| Tuesday 15:00 | Saturday 14:57:00 | 14:57:30 | Saturday 15:00:00 | Saturday 15:00:00.250 |
| Sunday 13:00 | Thursday 12:57:00 | 12:57:30 | Thursday 13:00:00 | Thursday 13:00:00.250 |
| Friday 18:00 | Tuesday 17:57:00 | 17:57:30 | Tuesday 18:00:00 | Tuesday 18:00:00.250 |
| Thursday 20:00 | Monday 19:57:00 | 19:57:30 | Monday 20:00:00 | Monday 20:00:00.250 |
| Saturday 18:30 | Wednesday 18:27:00 (needs `27,57 * * * *`) | 18:27:30 | Wednesday 18:30:00 | Wednesday 18:30:00.250 |

Every other hour the bot wakes at :57, finds no row and logs `Nothing to do`.

- **Everything runs and is tested on Railway.** The user's computer has no Node or Bun; don't install them and don't run the code locally. The only local tools are `curl` and the Railway CLI.
- **Test:** `curl -s "$APP_URL/test?user=3"` (dry run as user 3: finds a free court tomorrow at 07:00, never books), then `railway logs --service bookbot --lines 30` and look for `Test OK`.
- **Deploy:** push to `main` (Railway is connected to GitHub and builds the `Dockerfile`, Bun + Playwright Chromium). Don't use `railway up`.
- Env vars live in Railway Variables: `SHEET_URL`, and per user n (from the sheet's `name - n`) `METRO_EMAIL_<n>` / `METRO_PASSWORD_<n>`. Never ask for, print or commit a password.
- The booking flow works; don't change selectors or timing unless a log shows they broke.
