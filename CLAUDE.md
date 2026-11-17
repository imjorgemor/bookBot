# bookBot

**If the user wants to set up, configure, test or deploy this bot, follow `SETUP.md` step by step.** They are probably non-technical.

Books a padel court at Club at 00:00 Madrid. All code is in `src/index.ts`: a `Bun.serve()` server on Railway (Serverless), woken by a cron-job.org call to `GET /book` at 23:55 Madrid. It reads `day,hour` rows from a Google Sheet (CSV export) and uses Playwright (headless Chromium) to log in, wait until midnight and book.

- **Everything runs and is tested on Railway.** The user's computer has no Node or Bun; don't install them and don't run the code locally. The only local tools are `curl` and the Railway CLI.
- **Test:** `curl -s "$APP_URL/test"` (dry run: finds a free court tomorrow at 07:00, never books), then `railway logs --service bookbot --lines 30` and look for `Test OK`.
- **Deploy:** `railway up --service bookbot --detach`. Railway builds the `Dockerfile` (Bun + Playwright Chromium) on its servers.
- Env vars live in Railway Variables: `METRO_EMAIL`, `METRO_PASSWORD`, `SHEET_URL`. Never ask for, print or commit the password.
- The booking flow works; don't change selectors or timing unless a log shows they broke.
