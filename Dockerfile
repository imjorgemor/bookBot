FROM oven/bun:1.3.7

WORKDIR /app

# Dependencies (no dev tools)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Headless Chromium only (lighter than full Chromium) + its system libs.
# Installer runs with Node: under Bun its download fails with a TLS error.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates nodejs \
  && node node_modules/playwright/cli.js install --with-deps --only-shell chromium \
  && apt-get purge -y nodejs && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*

COPY tsconfig.json ./
COPY src ./src

# Web server: a call to /book at 23:55 Madrid wakes it, it books at 00:00
CMD ["bun", "src/index.ts"]
