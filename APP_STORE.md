# Ohr Chaim — App Store Submission Pack

Everything Apple will ask for, pre-answered from the actual codebase. Hand the
"Reviewer Notes" and "App Privacy" sections to App Store Connect verbatim.

---

## 1. App identity

| Field | Value |
|---|---|
| App name | Ohr Chaim |
| Subtitle | Miami Beach Orthodox Synagogue |
| Bundle ID | `com.manneeducation.ohrchaim` |
| Primary category | Reference (alt: Lifestyle) |
| Content rating | 4+ |
| Privacy Policy URL | https://ohrchaim.org/#privacy |
| Support URL | https://ohrchaim.org/#contact |
| Marketing site | https://ohrchaim.org |

**Description (draft):** Congregation Ohr Chaim is an Orthodox synagogue in
Miami Beach, FL. The app gives the community daily davening times, halachic
zmanim calculated for the shul's location, the Hebrew calendar, weekly shiurim,
and the ability to donate, sponsor a Kiddush, reserve High Holiday seats, and
manage membership and yahrzeit reminders — with native push for announcements
and on-device reminders for Shabbos candle lighting.

---

## 2. Guideline 4.2 (Minimum Functionality) — why this is an app, not a website

The app ships native capabilities that the website cannot provide:

- **Push notifications** for shul announcements (APNs/FCM). Admin announcement
  blasts are delivered to the device, not just by email.
- **On-device local notifications** for **Shabbos candle lighting** (45-min
  heads-up, Friday) and **havdalah / Shavua Tov** (Saturday night), computed
  from the shul's zmanim engine and scheduled locally so they fire even with no
  connection and the app closed.
- **Native share sheet** for the schedule / donation link.
- **Native status bar + splash screen + home-screen icon**, haptics.

These are wired in `native.js` (frontend) and `nativeApi.js` (backend:
`/api/push/register`, `/api/native/reminders`, push fan-out on announcements).

---

## 3. Reviewer Notes (paste into App Review Information → Notes)

> Congregation Ohr Chaim is the official app of an Orthodox synagogue in Miami
> Beach, Florida (a religious non-profit).
>
> **No login is required to review the app.** All primary features are on the
> home screen without an account: daily davening schedule, zmanim (halachic
> times), Hebrew calendar, weekly shiurim, donations, Kiddush sponsorship, and
> High Holiday seat reservations.
>
> To review the optional member area (profile, membership, yahrzeit reminders),
> a demo member account is provided:
>   • Email: [DEMO MEMBER EMAIL]   • Password: [DEMO PASSWORD]
> (The admin dashboard is internal staff tooling and is not required to review
> the app.)
>
> **Payments:** All payments are charitable donations and real-world synagogue
> services (membership dues for a physical congregation, sponsoring a physical
> Kiddush meal, reserving a physical seat for High Holiday services). They are
> processed by Stripe. No payment unlocks digital content or app features, so
> per Guidelines 3.1.3(e) and 3.1.5(a) these are not in-app purchases. Donations
> to the non-profit are collected per Guideline 3.2.1.
>
> **Push notifications** are used for synagogue announcements and Shabbos time
> reminders; the app requests permission on first launch and works fully if
> declined.

> ⚠️ Before submitting: create the demo member account in Firebase Auth and fill
> in the bracketed credentials above. (See §6.)

---

## 4. App Privacy "nutrition label" (App Store Connect → App Privacy)

Based on what the code actually collects. **No third-party tracking, no ads, no
analytics SDK is loaded** (the Firebase config carries a `measurementId`, but
the Analytics SDK is **not** included — only Auth — so no analytics data is
collected). Nothing is used for tracking across apps.

| Data type | Collected? | Linked to identity | Purpose |
|---|---|---|---|
| Name | Yes | Yes | App Functionality (membership, donations, contact) |
| Email address | Yes | Yes | App Functionality (account, receipts) |
| Phone number | Yes | Yes | App Functionality (contact, donation records) |
| Payment info (card) | **No — collected by Stripe, app never sees card numbers** | — | (declare under Stripe's policy) |
| Purchase history (donations/dues) | Yes | Yes | App Functionality |
| User content (yahrzeit names/dates, contact messages) | Yes | Yes | App Functionality |
| Device ID (push token) | Yes | Linked | App Functionality (notifications) |
| Coarse/precise location | **No** (zmanim use the shul's fixed coordinates, not the device) | — | — |
| Diagnostics / crash data | **No** | — | — |

"Data Used to Track You": **None.**

---

## 5. Payment / IAP compliance (the one to get right)

Ohr Chaim processes money via Stripe in four flows (see `app.js` + `server.js`):

1. **Donations** (one-time, Stripe PaymentIntent / Elements, stays in-app).
2. **Membership dues** (recurring, Stripe Checkout — opens in the in-app browser
   on native via `@capacitor/browser`).
3. **Kiddush / Seudas Shlishis sponsorship** (PaymentIntent).
4. **High Holiday seat reservation** (PaymentIntent).

**Why none of these require Apple IAP:**
- They are **charitable donations** and **real-world services / physical-world
  experiences** — membership in a physical synagogue, a physical meal
  sponsorship, a physical seat for in-person services.
- Apple Guideline **3.1.3(e)** (goods/services consumed outside the app) and
  **3.1.5(a)** (physical goods/services) explicitly allow payment methods other
  than IAP. Guideline **3.2.1** covers non-profit donation collection.
- **No payment unlocks any digital content or app feature** — the schedule,
  zmanim, calendar, and notifications are free to everyone. That is what would
  trigger 3.1.1 IAP, and it does not happen here.

**Action:** Keep the app description and any payment buttons framed as
donations / real-world services. Do **not** describe membership as "unlock" or
"premium app access."

---

## 6. Pre-submission checklist (what's left)

Code is done. Remaining items, in order:

- [ ] **APNs Auth Key** — in the Apple Developer portal (Certificates →
      Keys → +), create an "Apple Push Notifications service (APNs)" key, then
      upload the `.p8` to Firebase Console → Project Settings → Cloud Messaging.
      (Without this, push registration still works but no pushes deliver.)
- [ ] **Demo member account** — create in Firebase Auth; put creds in §3.
- [ ] **Screenshots** — 6.7" (iPhone 15/16 Pro Max) and 6.5" required; capture
      home/schedule/zmanim/donate from the simulator or device.
- [ ] **Generate icon + splash** — once the iOS project exists:
      `npx capacitor-assets generate --ios` (sources already in `assets/`).
- [ ] Confirm `Privacy Policy URL` page (`/#privacy`) loads publicly.
- [ ] Push permission usage string already covered by the plugin; confirm the
      Info.plist has no missing usage descriptions after `cap sync`.

---

## 7. Guideline 4.3 (Spam/Duplicate) — differentiation

This app shares a developer account with three unrelated apps. It is clearly
differentiated: unique **tree-of-life icon**, unique **synagogue** purpose, and
**unique features** no sibling app has (zmanim, candle-lighting notifications,
Kiddush/seat/donation flows). Distinct name, screenshots, and description.
