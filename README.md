# ScenTop

An online perfume shop: a website and Android app (Ionic + Angular) backed by a small Express API and a Neon Postgres database.

```
Browser / Android app  ──►  Express API (server/)  ──►  Neon Postgres
      src/ (Angular)          serves the website too        (or a built-in dev database)
```

## Run it on your computer

You need **Node.js 22.12 or newer** (24 recommended).

```bash
npm install
npm start
```

Then open **http://localhost:4200**. That's it: `npm start` runs the website (port 4200) and the API (port 3000) together.

With no setup, the API uses a small database stored in `.data/` on your computer and fills it with the 18 perfumes on first start. Delete the `.data` folder to reset it. Make sure nothing else is using ports 3000 and 4200.

| Command | What it does |
| --- | --- |
| `npm start` | Website + API together, with live reload |
| `npm run api` / `npm run web` | Only the API / only the website |
| `npm run test:all` | All tests (server + Angular) |
| `npm run lint:all` | Lint the Angular app and the server |
| `npm run build:all` | Production build of the website (`www/`) and server (`dist-server/`) |
| `npm run start:prod` | Run the production build (needs `DATABASE_URL` and `JWT_SECRET`) |
| `npm run db:check` / `db:migrate` / `db:seed` | Test the database connection / create tables / reload the perfumes |

## Use Neon (the real database)

1. Create a project at [neon.tech](https://neon.tech) and copy the **pooled connection string** (Dashboard, then Connect).
2. Copy `.env.example` to `.env` and set `DATABASE_URL` (and `JWT_SECRET`).
3. Run `npm run db:check`. It should print `Connected (postgres)`.
4. Run `npm start`. The tables are created automatically on first start (`server/db/migrations/`).

The browser never talks to Neon directly: the connection string lives only on the server, so nobody can read the database password from the website.

## Deploy

**Render (easiest):** push this repo to GitHub, choose *New, Blueprint* on Render and select the repo (`render.yaml` is included). Paste your Neon `DATABASE_URL` when asked. The website and API are served from one address.

**Docker (any host):** `docker build -t scentop .` then run it with `DATABASE_URL`, `JWT_SECRET` and `TRUST_PROXY=1` set.

Required settings in production: `DATABASE_URL`, `JWT_SECRET` (32+ random characters). See `.env.example` for all of them.

## Build the Android app

1. Deploy the server first, then put its address in `src/environments/environment.mobile.ts` (`apiUrl` and `siteUrl`).
2. `npm run build:mobile` then `npx cap sync android`, then `npx cap open android` to open Android Studio (or `npm run android:apk` for a debug APK).
3. Icons and splash screens come from `resources/`. Regenerate them with `npm run assets:android`.
4. For Google Play you need a signed release build, a privacy policy link (the site has one at `/privacy`) and the in-app account deletion (already in Profile).

## How the code is organised

```
src/app/
  core/       services (auth, cart, wishlist, orders, products), guards, HTTP interceptors, models
  layout/     header, side menu, footer, page frame
  shared/     product card, text field, quantity stepper, rating stars, peso pipe
  pages/      one folder per screen (home, shop, product-detail, cart, checkout, orders, login, ...)
  app.routes.ts   every URL in one place
src/theme/variables.scss    colours and sizes
src/global.scss             shared button/card/chip styles
server/
  routes/     one file per area (auth, products, cart, wishlist, orders, contact)
  services/   cart and catalogue logic (prices are always calculated here, never trusted from the browser)
  db/         connection, migrations (SQL), starter perfumes
  tests/      API tests that run against an in-memory Postgres
```

Things worth knowing:
- **Money** is stored and sent as whole centavos (`185000` = ₱1,850.00). Show it with the `peso` pipe.
- **Guests** can browse, save perfumes and fill a cart (kept on their device). When they log in, it is merged into their account.
- **Placeholders to replace:** the developer names (`pages/developers`), the company story (`pages/about`), the shop contact details (`core/company.ts`), perfume descriptions and prices (`server/db/seed-data.ts`), and the legal text (`pages/legal`).

## Not built yet

Google login, online payment (only cash on delivery), e-mail receipts, an admin screen to manage products and orders (use the Neon SQL editor for now), and an iOS project (`npx cap add ios` on a Mac).
