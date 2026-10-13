# PinkMeUP

Express/MongoDB booking API and a static frontend. Node 24 is tested; Mongoose requires Node >=20.19. Docker can provide a local MongoDB instance.

Install dependencies with `npm --prefix backend install` and `npm --prefix frontend install`. The repository has no committed dependency lockfiles.

For local development, start MongoDB (for example, `docker run -d --name pinkmeup-mongo -p 127.0.0.1:27017:27017 -v pinkmeup-mongo-data:/data/db mongo:8.0`). Configure an ignored `backend/.env.local` with:

```dotenv
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/pinkmeup_dev
JWT_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:3000
```

Also set `JWT_SECRET` and `SESSION_SECRET` to independently generated random values. Never commit real credentials. Start the API from `backend` with `DOTENV_CONFIG_PATH=.env.local node -r dotenv/config server.js` (or use `npm run dev` with the same environment variable).

Build and serve the frontend:

```sh
API_ORIGIN=http://localhost:5000 npm --prefix frontend run build
npm --prefix frontend start
```

The frontend build writes `frontend/dist` and generates public runtime configuration from `API_ORIGIN` or `API_URL`. Set `API_URL` when the API has a custom base path. Without an override, API requests use the frontend's origin. For Vercel, set `API_ORIGIN` to your backend's public origin in deployment settings; the included configuration builds and serves `dist`. The old hosted API is no longer embedded in source. Source pages can instead receive `window.API_ORIGIN`/`window.API_URL` before `js/config.js`, or an `api-origin` meta tag. These settings are public URLs, never credentials.

Set backend `FRONTEND_URL` to the frontend's public origin. `CORS_ORIGINS` accepts additional origins separated by commas. The static server configuration preserves `.html` links and their query parameters so Quick Book and reset tokens survive navigation.

Quick Book is available from the home page without signing in. It supports a specific stylist or automatic assignment to an available eligible stylist. Account pages require a valid server session. A new guest email creates a customer record; use password reset to establish a password for that record. Confirmation is displayed in the browser; email requires SMTP configuration.

Optional integrations:

- Google login: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`.
- Email: `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, optionally `EMAIL_FROM` and `EMAIL_SECURE`. Port 465 enables implicit TLS. A missing or failed email transport returns an error for password-reset requests.

Run `npm --prefix backend test` (or `npm --prefix frontend test`) after installing both packages. Tests exercise the API and Chromium against a unique disposable MongoDB database, which they remove afterward. They use local MongoDB by default; `TEST_MONGODB_URI` can select a dedicated test server. Tests never use the application's `MONGODB_URI`. A system Chromium at `/usr/bin/chromium` is supported, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`; otherwise install Playwright Chromium with `cd frontend && npx playwright install chromium`.
