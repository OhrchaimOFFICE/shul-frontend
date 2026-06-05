# shul-frontend

The Congregation Ohr Chaim website — `ohrchaim.org`.

Single-page React app written **without a build step**. The site is `index.html` + `app.js` (~3,600 lines, all components in one file) + `styles.css`. React 18 + ReactDOM are loaded from unpkg as UMD scripts, so every component is built with `React.createElement(...)` rather than JSX.

The companion repo is [`shul-backend`](https://github.com/OhrchaimOFFICE/shul-backend) — the Express API running as a Firebase Cloud Function.

> **Migrated off Netlify → Firebase Hosting (June 2026).** Production is currently deployed from the **`firebase-migration` branch** (not `main`). See "Deploy" below.

## Stack

- **Frontend:** vanilla HTML + CSS + JavaScript, no bundler, no JSX
- **UI:** React 18.3.1 + ReactDOM 18.3.1 from unpkg (UMD, version-pinned with Subresource Integrity hashes)
- **Routing:** hash-based (`#home`, `#account`, `#admin`, …) — no `react-router`
- **Styling:** `styles.css` + heavy inline styles in `app.js`
- **Client-side libraries:**
  - Firebase Auth + App compat v10.12.0 (gstatic CDN) — login only; the app never reads Firestore directly
  - Stripe.js v3 (`js.stripe.com`)
  - kosher-zmanim widget from `myzmanim.com` (iframe `srcdoc`)
  - **pdf.js** vendored at `/vendor/` — loaded on demand to rasterize an uploaded weekly-email PDF flyer into inline images
- **Backend calls:** `BACKEND_URL = ""` → all `/api/**` calls are **same-origin**, served by the Cloud Function via a Firebase Hosting rewrite (no CORS). Override with `window.__BACKEND_URL__` for local dev against a remote backend.
- **Local persistence:** `localStorage` stale-while-revalidate cache on a few public read endpoints

## Files

```
index.html        Page shell, meta tags, Firebase config injection
app.js            Entire React app (~3,600 lines)
styles.css        Global stylesheet
vendor/           pdf.js (pdf.min.js + pdf.worker.min.js), same-origin
logo.png, email-banner.png
firebase.json     Firebase Hosting config (rewrites + headers/CSP)
.firebaserc       Firebase project (ohr-chaim-site)
_headers          Legacy Netlify headers — unused on Firebase (kept for reference)
```

## Hosting (Firebase)

- **Host:** Firebase Hosting, project `ohr-chaim-site` (site `ohr-chaim-site` → `ohr-chaim-site.web.app`)
- **Public domains:** `ohrchaim.org` (apex) and `www.ohrchaim.org` (301-redirects to apex), both with Firebase-managed SSL
- **DNS / registrar:** GoDaddy. Apex `A` → `199.36.158.100` (Firebase) + `TXT hosting-site=ohr-chaim-site`; `www` CNAME → `ohr-chaim-site.web.app`. (Rollback: apex `A` → `75.2.60.5` returns to Netlify.) Email records (MX/SPF/DKIM/DMARC) are untouched.
- **Rewrites** (`firebase.json`): `/api/**` → the `api` Cloud Function (us-central1); everything else → `/index.html` (SPA fallback; safe because routing is hash-based).
- **Headers/CSP** live in `firebase.json` `headers` (see below), not `_headers`.

## Security headers

`firebase.json` sets a Content-Security-Policy plus `Strict-Transport-Security`, `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and `Permissions-Policy`. CSP `script-src` is limited to self + the CDNs used (unpkg, gstatic/Firebase, Stripe, myzmanim); `worker-src 'self' blob:` covers the pdf.js worker; `connect-src 'self' …` covers the now same-origin API. `'unsafe-inline'` is allowed for scripts only because the inline Firebase config can't use nonces on static hosting. Admin email previews render in a sandboxed `<iframe>` (no `allow-scripts`), so untrusted template HTML can't execute. **If you add a new third-party origin (script, API, or frame), update the CSP in `firebase.json`.**

## Public config

Intended to be public: Firebase web config in `index.html` (`window.__firebaseConfig__`) and the Stripe publishable key (`pk_live_…`) in `app.js`. Secret keys live only in the backend (Secret Manager).

## Auth

- Firebase Authentication, email/password only
- ID tokens sent to the backend as `Authorization: Bearer <token>`; admin = `users/{uid}.role === 'admin'`
- Authorized domains include `ohrchaim.org`, `www.ohrchaim.org`, `ohr-chaim-site.web.app`, `ohr-chaim-site.firebaseapp.com`, `localhost`

## Admin features (high level)

Behind `#admin` (admin role required): davening rules & overrides, **shiurim** (add/edit/delete), the **Email Center** (compose/blast, weekly schedule email with per-shiur toggles + PDF flyer + "resume" send), **donations** (manual entry, apply-to-bill, Stripe import, tax receipts, analytics), **members** (roster import, tags/tiers, per-member "Mark dues paid", exempt, reset password), **pledges/billing + sponsorships** (add/edit/delete, invoices), high-holiday seating, welcome-display slides/sponsors, and site images.

## Deploy

```bash
firebase login            # office@ohrchaim.org (owner of ohr-chaim-site)
firebase use ohr-chaim-site
firebase deploy --only hosting
```

Deploys from the working tree (currently the `firebase-migration` branch). Deploy the backend (`shul-backend`) too if the API changed. To add/manage a custom domain, use Firebase Console → Hosting.
