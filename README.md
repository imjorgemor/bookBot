# bookBot

Books a padel court at Club at 00:00 Madrid, when bookings open 3 days ahead. What to book comes from a Google Sheet (one `day,hour` row per weekday).

**Set it up:** open Claude Code Desktop and paste the prompt from [PROMPT.md](PROMPT.md). Claude downloads the code and follows [SETUP.md](SETUP.md) with you. Nothing to install beforehand.

Developers: `bun install`, then `bun run book:test` (dry run, never books) or `bun run book:now` (real booking). Needs `METRO_EMAIL`, `METRO_PASSWORD` and `SHEET_URL` in `.env`.
