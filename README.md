# ScenTop

Ionic + Angular mobile app with email/password authentication backed by Neon PostgreSQL.

## 1. Install

```bash
npm install
```

## 2. Create the Neon database

1. Create a project at Neon and copy its connection string.
2. Open the Neon SQL Editor and run `server/schema.sql`.
3. Copy `.env.example` to `.env` and place the connection string in `DATABASE_URL`.
4. Generate a long random value for `JWT_SECRET`.

Never commit `.env` or put `DATABASE_URL` inside the Angular environment files.

## 3. Run locally

Use two terminals:

```bash
npm run server
```

```bash
npm start
```

Open `http://localhost:4200`. The API runs at `http://localhost:3000`.

## Mobile testing

For an Android emulator, change the development API URL to `http://10.0.2.2:3000/api`. For a physical phone, use the computer's local network IP and allow it through the firewall. Production mobile builds need a deployed HTTPS API URL.

The Google buttons are styled to match the supplied mockup, but Google authentication still requires Google OAuth credentials and a verified OAuth flow.
