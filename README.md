# shul-frontend

The Congregation Ohr Chaim website — `ohrchaim.org`.

Single-page React app written without a build step. The full site is `index.html` + `app.js` (~3,200 lines, all components in one file) + `styles.css`. React 18 + ReactDOM are loaded from unpkg as UMD scripts, so every component is built with `React.createElement(...)` rather than JSX.

The companion repo is [`shul-backend`](https://github.com/OhrchaimOFFICE/shul-backend) — Express on Render at `shul-backend.onrender.com`.

## Stack

- **Frontend:** vanilla HTML + CSS + JavaScript, no build step, no bundler, no JSX
- **UI:** React 18.3.1 + ReactDOM 18.3.1 from unpkg (UMD, version-pinned with Subresource Integrity hashes), `React.createElement(...)` syntax
- **Routing:** hash-based and custom (`#home`, `#account`, `#admin`, …) — no `react-router`
- **Styling:** `styles.css` + heavy inline styles in `app.js`
- **Fonts:** Google Fonts (Playfair Display, Source Sans 3)
- **Client-side libraries:**
  - Firebase Auth + App compat v10.12.0 (gstatic CDN)
  - Stripe.js v3 (`js.stripe.com`)
  - kosher-zmanim widget from `myzmanim.com` (legacy iframe `srcdoc`)
- **Local persistence:** `localStorage` for stale-while-revalidate caching on a few public read endpoints

## Files

```
index.html        Page shell, meta tags, Firebase config injection
app.js            Entire React app (~3,200 lines)
styles.css        Global stylesheet
logo.png
email-banner.png
_headers          Netlify security headers (CSP, HSTS, X-Frame-Options, etc.)
```

## Hosting

- **Host:** Netlify — auto-deploys from `OhrchaimOFFICE/shul-frontend` on push to `main`
- **Internal URL:** `calm-fenglisu-30cfa0.netlify.app`
- **Public domain:** `ohrchaim.org` (also `www.ohrchaim.org`)
- **DNS / registrar:** GoDaddy. Apex A record → `75.2.60.5` (Netlify).
- **SSL:** Let's Encrypt (auto-provisioned + renewed by Netlify)

## Public config

These are intended to be public:

- Firebase web config in `index.html` (`window.__firebaseConfig__`)
- Stripe publishable key (`pk_live_…`) in `app.js`

The Stripe **secret** key and the webhook secret only ever live in Render env vars on the backend; the backend's `server.js` fails fast at boot if `STRIPE_SECRET_KEY` is missing.

## Security headers

`_headers` (served by Netlify) sets a Content-Security-Policy plus `Strict-Transport-Security`, `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and `Permissions-Policy`. The CSP `script-src` is limited to self + the specific CDNs used (unpkg, gstatic/Firebase, Stripe, myzmanim); `'unsafe-inline'` is allowed for scripts only because the inline Firebase config and static hosting can't use nonces. Admin email previews render in a sandboxed `<iframe>` (no `allow-scripts`) rather than `dangerouslySetInnerHTML`, so untrusted template HTML can't execute in the admin's session. If you add a new third-party origin (script, API, or frame), update the CSP in `_headers` or it will be blocked.

## Auth

- Firebase Authentication, email/password only (no Google/Apple sign-in)
- ID tokens are sent to the backend as `Authorization: Bearer <token>`
- Admin role is `users/{uid}.role === 'admin'` in Firestore
- Authorized domains: `ohrchaim.org`, `www.ohrchaim.org`, `calm-fenglisu-30cfa0.netlify.app`, `localhost`, `ohr-chaim-site.firebaseapp.com`

## Deploy

```bash
git push origin main
# Netlify rebuilds and ships in 30–60 sec.
```

No staging, no preview deploys. Pushes go straight to production.
