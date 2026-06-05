# Firebase migration — frontend (Firebase Hosting)

This branch (`firebase-migration`) serves the static site from Firebase Hosting
instead of Netlify. **Nothing here is deployed yet.** `main` still serves on
Netlify unchanged.

## What changed on this branch
- `app.js` → `BACKEND_URL = ""` (same origin). Hosting rewrites `/api/**` to the
  Cloud Function, so API calls go to this site's own domain — no CORS.
- `firebase.json` (new) → Hosting config:
  - `public: "."` with an ignore list.
  - rewrites: `/api/**` → the `api` function; everything else → `/index.html`.
  - `headers`: the security headers + CSP from `_headers`, with Render removed
    from `connect-src` (API is now same-origin). `_headers` is no longer used.
- `index.html` → removed the stale `preconnect` to the Render backend.

## Deploy (Phase 2 — test on the *.web.app URL first, before DNS cutover)
```bash
firebase login          # yosefmanne@manneeducation.com
firebase use ohr-chaim-site
firebase deploy --only hosting
# Test at https://ohr-chaim-site.web.app
```
Deploy the backend (`shul-backend`, same branch) first so `/api/**` resolves.

## Custom domain (Phase 4)
Firebase console → Hosting → Add custom domain → `ohrchaim.org` (+ `www`).
Follow the TXT verification, then point GoDaddy A records at the IPs Firebase
shows. Keep Netlify live until the Firebase cert is active, then cut over.
Rollback = revert the GoDaddy A records.

## Note on the function rewrite
`firebase.json` uses `rewrites[].function = { functionId, region }`. If a given
firebase-tools version rejects that form for a 2nd-gen function, switch it to:
`{ "source": "/api/**", "run": { "serviceId": "api", "region": "us-central1" } }`.
