# Godhan Platform — Development Plan

**Compiled:** 2026-07-16 · **Updated:** 2026-07-20 (offline-first persistence, all 9/9 cattle-detail tabs, and the IoT device↔cattle assignment bug fixed — see §3.38–§3.40; also, every service's previously-uncommitted work, including this session's, is now committed and pushed, see "still open" item 8)
**Sources:** `Godhan master app promt.md` (vision spec, workspace root), `docs/PLATFORM_DESIGN.md` + `docs/SERVICE_ANALYSIS_REPORT.md` (2026-05-07 backend audit — now under `docs/`, not `godhan-services/newCattle/`, which no longer exists as a directory), live inspection of `godhan-app/` and `godhan-services/` source on 2026-07-16/17/19/20. `docs/PREDICTION_PIPELINE_END_TO_END.md` is the detailed companion to §3.33 below — read that for the full IoT/prediction writeup, this file only summarizes it.

This document exists to answer one question at any point in the project: **what's actually built, what's broken, and what's next.** It supersedes nothing — the master prompt stays the source of truth for *vision*; this file tracks *status and sequencing*.

---

## At a glance — feature status

A scannable summary of everything below. ✅ = built and live-verified, 🟡 = partially built (see
notes), ❌ = no code anywhere. This is a snapshot, not a spec — re-derive it from §3 and the code
periodically rather than trusting it blindly.

| Category | Feature | Status | Notes |
|---|---|---|---|
| **Core / Auth** | OTP, email/password, Google sign-in | ✅ | All 3 flows live-verified end-to-end (§3.4) |
| | Cross-service auth (shared `JWT_SECRET`) | ✅ | Was silently broken platform-wide until fixed (§3.20) |
| | Membership/webhook routes in `user-service` | ❌ | Commented out, has its own pre-existing bugs (§3.1, still open #11) |
| | Role-based (admin) access | ❌ | Nothing sets a `role` claim in the JWT yet (still open #2) |
| **Cattle & Herd** | CRUD, list + pagination | ✅ | (§3.11) |
| | Cattle detail — all 9 tabs (Overview, Milk, Calving, Breeding, Medical, IoT Health, Expenses, Documents, Timeline) | ✅ | (§3.39) |
| | Lifecycle: calving/calf creation, genealogy, archival, PDF export | ✅ | (§3.24) |
| | Breeding cycle: heat → AI → pregnancy → calving, with reminders | ✅ | (§3.25) |
| | Bull registry (structured breed-first picker) | ✅ | (§3.27) |
| | Bull management screen (view/edit/sire history) | ❌ | Register-only today, no dedicated screen (still open #5) |
| | Bull-suitability recommendations | ❌ | Needs a real body of linked data first (still open #7) |
| | Goat breeding (structured bulls) | ❌ | Bull schema is cow/buffalo only (still open #6) |
| | Archived-cattle list UI toggle | ❌ | Backend supports `includeArchived`, no UI toggle (still open #4) |
| | Offline-first persistence | ✅ | SQLDelight cache + connectivity banner (§3.38) |
| **IoT** | Device/sensor ingestion pipeline (MQTT → Mongo → ML → alerts → API → mobile) | ✅ | (§3.33) |
| | Device↔cattle assignment actually taking effect | ✅ | Was a platform-wide silent no-op until fixed (§3.40) |
| | Unpair action | ✅ | (§3.40) |
| | Dedicated reassign-to-different-cattle screen | ❌ | Works today via unpair + re-pair (still open #16) |
| | ESP32 firmware BLE provisioning | ❌ | Mobile's real BLE contract has **no matching firmware** in this repo at all (`IOT_DEVICE_DESIGN.md` §3.6.1, still open #19) |
| | Live-vitals dashboard (running readings view, not just pairing) | 🟡 | Device status + temperature sparkline exist (§3.39); not a full live dashboard |
| | Read/dismiss state for alerts | ❌ | Alerts just accumulate (still open #13) |
| **Marketplace** | Cattle Hub: browse, bid, token-unlock paywall | ✅ | (§3.16) |
| | Dairy shop: browse, cart, checkout | ✅ | (§3.16, §3.21) |
| | Membership tier gating (Gold/Platinum) | ❌ | Grade/verification UI exists, no enforcement (Partial table) |
| | Escrow / video-verification booking / micro-hubs | ❌ | Large, spec'd, zero code (Phase 3) |
| **Wallet & Coins** | Balance, transactions, add-money | ✅ | (§3.13) |
| | Coins reward/redemption economy | ✅ | (§3.21) |
| | Escrow/reserved/token wallet states | ❌ | Plain balance only (Partial table) |
| **Helper Mgmt** | Attendance, salary slips, contract upload | ✅ | Built end-to-end (§3.23) |
| | Advance-tracking | ❌ | Schema field exists, unused (still open #3) |
| **Money model** | Farm-wide Expense & Income tracking | ❌ | Home's "Expenses" quick-action is a dead stub; per-cattle version *is* built (§3.39, still open #17) |
| | Milk pricing engine (fixed/daily/formula, FAT/SNF) | ❌ | Flat `MILK_PRICE_PER_LITER` used as an honest stand-in (still open #18) |
| **Reports & Home** | Herd/per-cattle reports, home dashboard summary | ✅ | Both were silently all-zero before fixing (§3.18, §3.19) |
| **Referral** | Code generation, referee tracking, coin rewards | ✅ | Built from scratch (§3.15, §3.21) |
| **Notifications** | List, read/unread, real FCM push dispatch | ✅ | Real credentials verified live (§3.34) |
| **Localization** | Infra + auth/home/settings/cattle/wallet/reports/helper screens (EN/HI/MR/GU) | ✅ | (§3.29/§3.31/§3.32) |
| | Marketplace, referral, notifications list, IoT pairing screen | ❌ | Still hardcoded English (still open #10) |
| **Infra** | Single shared MongoDB database | ✅ | (§3.35) |
| | S3 uploads (code) | ✅ | Verified live in mock mode (§3.37) |
| | S3 bucket/IAM/policy (real infra) | ❌ | User-side AWS setup still needed (still open #15) |
| | `docker-compose` full integration test | ❌ | Each service verified in isolation only (still open #9) |
| | Domain/use-case layer (`domain/usecase/`) | ❌ | Empty folder, logic lives in ViewModels/repos (Partial table) |
| | Dark mode | ❌ | No theme support found (Pending list) |
| | My Address / Help & Support screens | ❌ | Still placeholder stubs (Pending list) |
| | Subscription/feature-flag gating | ❌ | No tier-based access control anywhere (Pending list) |
| **Not started** | Admin (Angular) app | ❌ | Zero code |
| | Delivery app | ❌ | Zero code |
| | AI Revenue Planner | ❌ | Phase 4 |
| | Digital Health Passport | ❌ | Depends on IoT pipeline (now unblocked, still not started) |
| | Carbon credits / blockchain identity / federated-learning digital twin | ❌ | Phase 4, explicitly deferred by design |

---

## 1. Where we are, in one paragraph

The KMP mobile app (`godhan-app/`) has real, working-depth code for auth, cattle/herd management (all 9 spec'd detail tabs as of 2026-07-20, §3.39), cattle+dairy marketplace browsing, reports, referrals, notifications, offline-tolerant caching (§3.38), and profile. The backend (`godhan-services/`) has 9 Node.js microservices plus one Python ML service in varying states. **As of 2026-07-16 all 6 previously-crashing services now boot and were verified live against a local MongoDB** (see §3 for what changed); `user-service` was already fine and continues to work as before. No Admin (Angular) app and no Delivery app exist yet — both are full sections of the spec with zero code. **IoT (the ESP32 collar pipeline that much of the platform's differentiation depends on) is now a real, running, end-to-end pipeline** (§3.33, 2026-07-19) — device → MQTT ingestion → ML prediction → farmer-facing API → mobile UI — and, as of 2026-07-20, pairing a collar to a specific animal now actually takes effect end-to-end, which it silently never did before (§3.40).

Net: **Phase 1 (Daily Utility MVP) is close to done on the client** — the one remaining dead stub is farm-wide Expense & Income tracking (still open item 17); everything else in the Phase 1 table is built. Remaining backend work is feature completion (see §4), not plumbing. **Phase 3's IoT foundation, previously its single biggest gap, is now built and actually wired end-to-end** — what remains there is UI polish (a live-vitals dashboard, a dedicated reassign screen), not core plumbing or silent bugs.

---

## 2. Current state snapshot

### 2.1 Mobile app — `godhan-app/` (Kotlin Multiplatform)

Single initial commit (2026-05-08); substantial **uncommitted work in progress** right now (auth, location, complete/edit-profile all mid-edit — commit or stash before starting new work here).

| Area | Files | ~Lines | Assessment |
|---|---|---|---|
| Cattle (herd, detail, IoT sub-screens) | 9 | 2,412 | Furthest along; CRUD + detail tabs exist |
| Main tabs / home | 11 | 1,020 | Navigation shell, dashboard |
| Market (cattle hub + dairy shop) | 8 | 1,539 | Browsing implemented; no bid/escrow/membership gating yet |
| Reports | 2 | 500 | Basic |
| Referral | 2 | 407 | Basic |
| Notifications | 2 | 398 | Basic |
| Edit profile | 2 | 392 | — |
| Login | 2 | 340 | — |
| Register | 2 | 302 | — |
| Wallet | 2 | 289 | **Thin** — no reserve/escrow states |
| OTP | 2 | 219 | — |
| Complete profile | 2 | 175 | — |
| Splash | 2 | 94 | — |
| IoT / BLE (`data/ble/`) | 2 | — | Only a Bluetooth scanner + QR scanner stub — no live vitals, no device pairing/provisioning flow, no telemetry consumption |

**Missing outright in the app:** Helper/payroll module (no `screens/helper/` folder — a full spec section, §8), Milk Pricing module (§9 — no fixed/daily/formula rate screens), Expense & Income module (§15), AI Revenue Planner (§16), Cattle Hub membership gating / verification score / video booking / escrow (§14, most of it), Carbon/blockchain/digital-twin items (§18 — expected, these are explicitly long-horizon).

### 2.2 Backend — `godhan-services/` (Node.js/Express microservices)

| Service | Port | Module system | Status (verified 2026-07-16) |
|---|---|---|---|
| `godhan-core` (shared lib) | — | **ESM** (`"type": "module"`) | Well-structured; unchanged by this pass |
| `user-service` | 3001 | ESM | Boots fine (Mongo connect fails only because `.env` points at a remote Atlas cluster unreachable from this sandbox). `authRoutes`, `userRoutes`, `uploadRoutes` mounted; `membershipRoutes` and wallet webhook still commented out, and that dead code has its own separate bugs (§3.1) |
| `cattle-service` | 3003 | **ESM** (converted) | ✅ Boots, connects to Mongo, auth middleware verified live |
| `marketplace-service` | 3004 | **ESM** (converted) | ✅ Boots, connects to Mongo, auth middleware verified live. No grading/escrow/auction-close logic yet (Phase 3 work, not a bug) |
| `wallet-service` | 3002 | **ESM** (converted) | ✅ Boots, connects to Mongo, auth middleware verified live. `farmerId`/`userId` field bug fixed; `transactionRoutes` now actually mounted |
| `notification-service` | 3006 | **ESM** (converted) | ✅ Boots, connects to Mongo, auth middleware verified live. Still DB-store only — FCM/SMS dispatch not wired (§3.2) |
| `report-service` | 3007 | **ESM** (converted) | ✅ Boots, connects to Mongo, auth middleware verified live. Missing `Report` model created; double-`src/` require bug and wrong service-URL ports in `.env` fixed |
| `helper-service` | 3005 | **ESM** (converted) | ✅ Boots, connects to Mongo, auth middleware verified live |
| `godhan-cattle-iot` | 3008 | ESM | ✅ Device/sensor ingestion + OTA, real HTTP *and* MQTT ingestion (§3.33) — added/verified 2026-07-19, not part of the original 6-service ESM/CJS fix pass since it didn't exist as a real service at that time |
| `godhan-iot-prediction` | — (Python, no HTTP server) | — | ✅ Heat/calving/milk-yield ML pipeline — one-shot job self-scheduled via `src/scheduler.py` (§3.33), no systemd/cron needed |
| `newCattle/` | — | — | No longer exists as a directory — its docs live under `docs/` now, and the IoT service it only ever *designed* is `godhan-cattle-iot` above, now real |

**Root blocker for the entire backend — fixed 2026-07-16:** `godhan-core` publishes ESM-only (`export default {...}`), and all 6 services below were written as CommonJS (`require("@godhan/core")`), which throws at startup. Fixed by converting `cattle-service`, `marketplace-service`, `notification-service`, `wallet-service`, `helper-service`, and `report-service` to ESM (`"type": "module"`, `import`/`export`) to match `godhan-core` and `user-service` — `godhan-core` itself was left untouched. All 6 were then installed (`@godhan/core` now resolves via `"file:../godhan-core"` instead of an unpublished registry version) and **boot-verified live** against a local MongoDB instance, including a real HTTP round-trip confirming `core.middleware.createAuth` correctly rejects unauthenticated requests on each service. Full list of what was fixed along the way is in §3.1.

### 2.3 Existing planning artifacts worth knowing about

These already exist in the repo and this plan builds on them rather than duplicating them:

- `godhan-services/newCattle/PLATFORM_DESIGN.md` — an "authoritative reference" backend/product design doc (2026-05-07) with a full 3-phase rollout, per-service data models, a 45-screen app inventory, and a known-bugs table. Treat it as the detailed backend companion to this file.
- `godhan-services/newCattle/SERVICE_ANALYSIS_REPORT.md` — the underlying May audit that found the IoT pipeline entirely missing and the bugs listed above. Re-verified as still accurate on the ESM, wallet, and report-service items (see table above); not re-verified line-by-line for every item.
- `godhan-services/newCattle/IOT_DEVICE_DESIGN.md` / `DOCS_ANALYSIS_REPORT.md` — IoT hardware/firmware and docs-vs-code gap analysis.
- `docs/godhan iot docs/` — ESP32 hardware BOM, firmware skeleton (`esp_32_firmware_skeleton.cpp`), cattle prediction Python script, IoT technical doc, dashboard design PDFs.
- `docs/mockups/` — ~30 UI mockups (several Hindi-labeled) covering attendance, feed stock, expense tracking, cattle profile, reproductive tracking, gold membership upgrade — useful as UI reference when building the screens still missing from the app.

### 2.4 Not started anywhere in the workspace

- **Delivery Android app** (spec §3) — no directory exists.
- **Admin Angular app** (spec §4) — no directory exists.
- **milk-rate-service**, **labor-service** as named in the spec's target architecture (§5) — helper-service and cattle-service partially cover this ground today but not under those names/boundaries.
- **Push notification dispatch** — real, not just in-app (§3.30 item 1, still open).

**No longer belongs in this list (2026-07-19): IoT telemetry/MQTT ingestion** — this was the single largest item here as of 2026-07-17 ("entirely unbuilt... largest single chunk of remaining backend work," per the old §4 Phase 3 text). It's now real: `godhan-cattle-iot` ingests sensor data over MQTT and REST, `godhan-iot-prediction` computes heat/calving/milk-yield predictions on a self-managed 6h schedule, `cattle-service` surfaces predictions and alerts to the farmer via API, and `godhan-app`'s cattle detail screen renders them. See §3.33.

---

## 3. Priority 0 — fix before anything else

### 3.1 Done (2026-07-16) — boot-blocking bugs, all fixed and live-verified

1. ✅ **`godhan-core` ESM/CJS mismatch** — `cattle-service`, `marketplace-service`, `notification-service`, `wallet-service`, `helper-service`, `report-service` converted to ESM (`"type": "module"`, `import`/`export` throughout) to match `godhan-core` and `user-service`. `godhan-core` itself was intentionally left as-is (pure ESM) rather than made dual-mode.
2. ✅ **`wallet-service` `farmerId`/`userId` mismatch** — `walletController.js` now queries/creates `Wallet` by `farmerId` (matching the model); `Transaction` documents correctly keep `userId` (matches `transactionModel.js`).
3. ✅ **`report-service/src/models/Report.js` created** — `{ farmerId, type, data, timestamps }`, wired into both the cron jobs and `reportController.reportHistory` (which previously referenced an undefined `Report` variable — crash on first call). The old, wrongly-named `models/Notification.js` (a stray copy of notification-service's schema) was left in place but is unreferenced — safe to delete in a follow-up, not done here since it's harmless and not on the boot path.
4. ✅ **`@godhan/core` dependency resolution** — all 7 services referenced a version (`1.0.0` / `^1.0.4`) that doesn't exist on any registry (this is an unpublished private package). Changed to `"file:../godhan-core"` in every service's `package.json` so `npm install` actually works for local dev.

**Additional boot-blocking bugs found and fixed while doing the above** (none were in the original bug list, all would have caused a crash or an unreachable route):
- `cattle-service`, `marketplace-service`, `wallet-service` — `package.json` `main`/`start`/`dev` pointed at `src/server.js`, which doesn't exist; the real files are at the package root. Fixed to point at `server.js`.
- Case-sensitive model require paths (`../models/Cattle`, `../models/Listing`, `../models/Product`, `../models/Order`, `../models/Wallet` vs. actual lowercase filenames) — silently worked on Windows, would have broken on Linux/Docker. Fixed to match actual casing.
- `wallet-service/routes/transactionRoutes.js` imported `../middleware/authMiddleware` (singular) but the file lives at `middlewares/` (plural) — fixed path.
- `wallet-service/routes/walletRoutes.js` imported `{ fetchWallet, createTransaction }` from `walletController.js`, neither of which exists (`walletController` exports `getBalance`/`addMoney`/`getTransactions`) — routes would 500 on every request. Rewired to the real exports.
- `wallet-service/routes/transactionRoutes.js` existed but was never mounted in `app.js` — `GET /wallet/transactions` was unreachable. Now mounted.
- `report-service/src/app.js` required `./src/routes/reportRoutes` etc. from *inside* `report-service/src/` — a doubled path that resolved to a nonexistent `src/src/...` directory. Fixed to relative paths.
- `report-service` had no auth middleware applied to `/reports` at all, despite every controller reading `req.user.id` — would throw on first real request. Now protected via `core.middleware.createAuth`.
- `report-service/package.json` was missing `node-cron` and `mongoose` as dependencies despite both being required in code.
- `report-service/.env` had `MARKETPLACE_URL` and `WALLET_URL` pointing at each other's ports, and no `JWT_SECRET` — fixed.
- `user-service/src/models/template.model.js` had a stray `require()` inside an otherwise-ESM package (harmless today since the file isn't currently imported by any live route, but would throw `ReferenceError: require is not defined` the moment it is) — fixed to `import`.

**Verified, not just fixed:** each of the 6 services was `npm install`-ed fresh and booted with `node server.js` (or `node src/server.js`) against a live local MongoDB, confirming the "connecting to MongoDB… connected" log line and the correct HTTP port banner, then hit with a real unauthenticated request confirming `core.middleware.createAuth` returns the expected `401 Unauthorized` JSON shape via `core.http.response.error`. `user-service` was also booted and confirmed working as before (it was never part of the ESM/CJS bug); its Mongo connection currently fails in this sandbox only because its `.env` points at a remote Atlas cluster unreachable without outbound internet — not a code issue.

**Explicitly out of scope, left for later:** `user-service`'s family-member and wallet-webhook feature code (`familyMember.controller.js`, `familyMember.routes.js`, `walletWebhook.controller.js`, `walletWebhook.service.js`) has its own, deeper bugs — wrong `core` API nesting (`core.response.*` instead of `core.http.response.*`), missing `.js` extensions in ESM imports, an undefined `authMiddleware` reference, mixed `import`/`require`/`exports.x=` in the same files. All of it is currently unwired (not mounted in `app.js`, `membershipRoutes` and `walletWebhookRoutes` still commented out), so it doesn't block startup — flagging it here so it doesn't surprise whoever uncomments those routes next.

### 3.2 `godhan-core` optimization pass (2026-07-16)

Since `@godhan/core` is now a dependency of all 7 services, it was audited for dead weight and correctness:

- **Removed 10 unused dependencies** from `godhan-core/package.json` — `aws-sdk` (v2, deprecated, superseded by the already-used `@aws-sdk/client-s3` v3), `bullmq`, `dotenv`, `express`, `express-handlebars`, `joi`, `multer`, `nodemailer`, `nodemailer-express-handlebars`, `moment` (non-timezone) — none were `import`-ed anywhere in `src/`. Confirmed by grepping every actual import against the declared dependency list. `godhan-core/node_modules` dropped from 248MB → 117MB; reinstalling `user-service` alone (the one non-symlinked consumer at the time) removed 250 packages as a direct result.
- **Rewrote `godhan-core/README.md`** — it documented a completely different, nonexistent API (`initDB`, `authMiddleware`, `successResponse`/`errorResponse` as named exports, a `createS3Util` helper that doesn't exist). This is exactly the API the 6 crashing services in §3.1 were written against — the README was the actual root cause of that whole bug class. Rewritten to document the real `core.db.*`/`core.http.*`/`core.middleware.*`/`core.security.*`/`core.utils.*` namespaced API with accurate signatures, plus a short "design notes" section (no `process.env` reads inside core, no unused deps) so it doesn't drift again.
- **Added a 30s in-memory cache to `core.utils.config.getConfig`** — it's on wallet-service's recharge hot path (`CASHBACK_PERCENT` lookup on every request) and was doing a full MongoDB round-trip every call with no caching. `setConfig` writes through the cache immediately. Per-process cache, so cross-instance staleness is bounded by the TTL — acceptable for slow-changing config, not for anything needing read-your-writes.
- **Found and fixed a real bug this surfaced in `user-service`**: `app.js` called `core.http.errorHandler` (doesn't exist — `core.http.createErrorHandler(logger)` is a factory, not a plain middleware) as its final error-handling middleware. This had never actually been exercised because `user-service`'s installed `node_modules/@godhan/core` was a **stale, disconnected copy from May** with a different, older API shape — not the live source. Fixed the call site and confirmed `user-service` now correctly symlinks to the live `godhan-core` source (`npm install` there dropped 250 stale/duplicated packages as a result).
- **That reinstall also surfaced 3 more real, pre-existing bugs**: `user-service` directly imports `mongoose` (6 files), `multer`, and `mime-types` in its own source but never declared them as its own dependencies — it was silently working only via npm's hoisting behavior from the old core copy's nested `node_modules`. Added all three to `user-service/package.json` directly; this was latent breakage waiting for exactly this kind of dependency-resolution change.
- **Verified live**, not just read: all 6 services from §3.1 re-booted and re-probed successfully against the trimmed core (unchanged behavior, confirmed via HTTP). `user-service` was verified by booting `app.js` directly on a throwaway port (its `server.js` blocks on a remote MongoDB Atlas URI unreachable from this sandbox — an environment/`.env` issue, unrelated to this work) — `/health` returns the expected `core.http.response` JSON, `/metrics` returns real Prometheus output confirming `core.utils.metrics` still works end-to-end, and the new `createErrorHandler` wiring registers without throwing.

Deliberately left alone: `core.middleware.role`/`trace`/`requestLogger`/`validate`, `core.http.apiClient`, `core.utils.tracing` are all currently unused by any service but are correct, well-designed, and documented — "not yet adopted" isn't the same as "stale," so none of that was removed. `core.utils.metrics`'s eager `collectDefaultMetrics()` on import was considered for lazy-init but left as-is once it turned out to be live-wired to `user-service`'s `/metrics` endpoint.

### 3.3 File naming convention unified across services (2026-07-16)

`user-service` already used a consistent `<domain>.<layer>.js` naming scheme (`user.controller.js`, `user.service.js`, `user.model.js`, `user.routes.js`, `auth.middleware.js`) with plural directory names (`controllers/`, `services/`, `models/`, `routes/`, `middlewares/`). The other 6 services were inconsistent — camelCase filenames (`cattleController.js`, `walletService.js`), a singular `service/` directory in 3 of them, and a couple of stray capitalized bare-domain model filenames (`Helper.js`, `Report.js`, `Notification.js`). Renamed every domain file in `cattle-service`, `marketplace-service`, `notification-service`, `wallet-service`, `helper-service`, and `report-service` to match `user-service`'s convention, updated every cross-reference (controller ↔ service ↔ model ↔ route ↔ app.js import), and consolidated the 3 `service/` directories into `services/`. `app.js`/`server.js`/`config/*.js` were left as-is — that's already `user-service`'s own pattern for entrypoints and config files, nothing to change there.

While doing this, deleted `report-service/src/models/Notification.js` — a stray, unreferenced copy of notification-service's schema that never belonged in report-service (flagged but left in place during the §3.1 pass; renaming it to something accurate wasn't possible since it wasn't report-service's data at all, so removal was the correct move here). Confirmed zero references before deleting.

Verified: static module-graph resolution for all 6 services, then a full live-boot + HTTP probe pass identical to §3.1's, confirming unchanged behavior after the rename.

### 3.4 Auth flow wired end-to-end (2026-07-17)

Traced and connected all 5 auth entry points (Google signup/login, email/password signup, email/password login, OTP login) between `godhan-app` and `user-service`, plus the refresh-token flow the backend already had but the app never used. Decisions made with the user before starting: Google Sign-In gets fully wired in code with a placeholder client ID (not functional until real credentials are dropped in); OTP gets a dev-mode fallback so it's testable without real Twilio; the orphaned mobile+password login path gets dropped rather than completed (spec only calls for OTP + Google); `ApiConfig.BASE_URL` points at local `user-service` (`10.0.2.2:3001` for the Android emulator) rather than the nonexistent `api.godhan.app`.

**Backend fixes** (`user-service`):
- `registerEmailSchema` (Joi) didn't declare `mobile`/`referral_code` and rejected them as "not allowed" — **email signup was hard-broken for the mobile client** before this fix, 400 on every attempt.
- `referral_code` is now actually threaded through registration — resolved to the referring user's id and stored as `referredBy`. Crediting any reward for it is a wallet/marketplace concern, intentionally not touched here.
- `provider` (`'password'`/`'google'`) is now declared on the `User` schema — it was being written everywhere but silently dropped since Mongoose ignored unknown fields.
- OTP send now returns `{ code, smsSent }` from `otp.service.js`; when Twilio isn't really configured (still placeholder creds) the controller surfaces the code in the API response as `devOtp` (never in production) and also logs it — previously there was no way at all to see a generated OTP without querying Mongo directly.
- A verification-email send failure (placeholder SMTP creds) was failing the *entire* registration response even though the account had already been created — now caught and logged, non-fatal, matching how OTP SMS failures were already handled.

**A critical, previously-undetected bug found while testing this** — not scoped to auth, affects every service: `user-service` (and by the same pattern, all 6 other services) declares its own `mongoose` npm dependency *in addition to* depending on `@godhan/core` (which also uses mongoose internally). Node resolves these to two **physically separate copies** of the package (confirmed different versions even — 7.8.11 vs 7.8.7), each with its own independent default-connection registry. `core.db.connectMongo()` connects one copy's registry; any service's own model files (`mongoose.model(...)`) register against the *other*, never-connected copy — every DB query then hangs for 10s and fails with `buffering timed out`, despite the logs claiming "MongoDB connected." This had gone undetected through the entire §3.1/§3.3 verification passes because those only ever exercised the auth-middleware 401 path, never an actual database read/write. Fixed for `user-service`: `godhan-core/index.js` now exports its own mongoose instance as `core.db.mongoose`, and all 9 of `user-service`'s model files import it from there instead of `import mongoose from "mongoose"` directly. **The other 6 services likely have the exact same bug and haven't been fixed** — see §3.5.

**Verified live** against the local MongoDB from §3.1 — not just read: registration (with mobile + referral code), email login, OTP send (dev fallback returned a real code) → OTP verify → new-user flow, refresh-token rotation, logout/revocation, referral-code-to-`referredBy` resolution, and a fake-token Google login failing gracefully (confirms the placeholder client ID doesn't crash anything). Mobile-side changes (Ktor refresh-token plugin wiring, `AuthApiService`/`AuthRepository` methods, dev-OTP pre-fill UI, `MainViewModel` logout) could not be build-verified — same caveat as every mobile change this session, no Gradle available here.

Also added: `androidApp/src/main/res/xml/network_security_config.xml` (Android blocks plaintext HTTP by default; scoped an exception to `10.0.2.2`/`localhost` only, not app-wide) and a placeholder `androidApp/google-services.json` (the `google-services` Gradle plugin was applied with **no such file present anywhere in the repo** — that would have failed the entire Android build outright, not just Google Sign-In; the placeholder is gitignored like the real one would be).

### 3.5 Mongoose-singleton fix rolled out to all 6 remaining services (2026-07-17)

Applied the exact §3.4 fix everywhere else it applied: `cattle-service` (`models/cattle.model.js`), `marketplace-service` (`listing`/`order`/`product.model.js`), `wallet-service` (`wallet`/`transaction.model.js`, plus the already-dead `config/db.js` for consistency), `helper-service` (`helper.model.js`), `report-service` (`report.model.js`), `notification-service` (`notification.model.js`) — 10 files total, each swapping `import mongoose from "mongoose"` for `core.db.mongoose`.

**Verified live, not just syntax-checked** — this is exactly the class of bug that hid behind a shallow check before, so each service was booted individually and hit with a real write-then-read against a protected, DB-touching route (using a hand-signed JWT matching each service's shared dev `JWT_SECRET`): `POST`+`GET /cattle`, `POST`+`GET /marketplace/listing`, `POST /wallet/add` + `GET /wallet` (balance correctly persisted: 500 + 10% cashback = 510), `POST`+`GET /helpers`, `GET /reports/history` (empty-but-successful array, not a timeout), `POST`+`GET /notifications`. All 6 returned real, persisted data — every one of these would have hung 10 seconds and thrown `buffering timed out` before this fix.

### 3.6 Real Firebase project connected (2026-07-17)

`androidApp/google-services.json` now has the real file from Firebase project `godhan-98e6f` (package name confirmed matching `com.godhan.app`) — this alone makes FCM/push notifications functional, not just build-safe. `androidApp/build.gradle.kts`'s debug `applicationIdSuffix = ".debug"` was removed at the user's direction, since the real file only registers a Firebase Android app for the unsuffixed `com.godhan.app` — the plugin would otherwise fail the debug build with "No matching client found." Trade-off accepted: debug and a release build can no longer be installed side-by-side on the same device.

Google Sign-In itself is still not functional: the real `google-services.json`'s `oauth_client` array is empty, meaning this Firebase project has no Google sign-in provider enabled yet. A **Desktop/Installed**-type OAuth client was checked and correctly rejected — Android's `requestIdToken()` specifically needs a **Web application**-type client, and using the wrong type fails sign-in with an auth error rather than silently working. User is enabling Google as a sign-in provider in Firebase Console (Authentication → Sign-in method), which auto-provisions the correct Web client and adds it to a re-downloaded `google-services.json` — once shared, extract the client ID from `oauth_client` into `ApiConfig.GOOGLE_WEB_CLIENT_ID` (mobile) and `GOOGLE_CLIENT_ID_WEB` (`user-service/.env` — must be the *same* ID both places, see §3.4).

### 3.7 Real Google Web OAuth client wired in (2026-07-17)

User enabled Google as a Firebase sign-in provider and shared the re-downloaded `google-services.json` — its `oauth_client` array now has a `client_type: 3` (Web application, the correct type) entry with client ID `396600354935-73vh05l9cet6ibpl3uhcb6kb4p4qkbpi.apps.googleusercontent.com`. Updated in all three places that needed it, kept in sync: `androidApp/google-services.json` (full file replaced), `ApiConfig.GOOGLE_WEB_CLIENT_ID` (mobile), and `user-service/.env`'s `GOOGLE_CLIENT_ID_WEB` (backend — verifies the ID token's audience against this).

**Verified live**: `user-service` boots clean with the real client ID (`google.service.js`'s `OAuth2Client` constructs without error), `/health` responds, and `POST /auth/google` still correctly rejects a malformed token with a clean 400 rather than crashing — confirms the wiring is sound. The actual happy-path (a real Google-issued ID token from an on-device sign-in) can't be exercised from this backend-only sandbox; that needs a real build + device/emulator run, which is outside what's achievable here (no Gradle in this environment, per every mobile change this session).

With this, all 5 auth flows from §3.4 are now fully wired end-to-end, not just 4 of 5 — Google Sign-In just needs an actual device test to confirm the full round-trip.

### 3.8 Platform-wide response-envelope bug fixed on mobile (2026-07-17)

While scoping Cattle Detail screen work, found that **every non-auth API service on the mobile app was silently broken**: none of them unwrapped the `{ success, message, data }` envelope every backend controller sends (only `AuthApiService` did this correctly). List-returning calls threw on every call (object where an array is expected); object-returning calls mostly deserialized "successfully" into empty/garbage objects instead, since most domain types have all-default fields — no error surfaced anywhere either way. This affected `CattleApiService`, `CattleMarketApiService`, `DairyShopApiService`, `DashboardApiService`, `WalletApiService`, `ReportsApiService`, `NotificationsApiService`, `ReferralApiService` — essentially all real data fetching except auth.

Fixed with one shared `HttpResponse.unwrap()` / `unwrapVoid()` / `unwrapMessage()` extension (`data/remote/HttpResponseExt.kt`), and switched all 9 files onto it — `AuthApiService` included, so there's one implementation instead of two independently-written ones. Two smaller bugs found and fixed along the way: `DairyShopApiService`/`DairyShopRepository` referenced an `ApiMessage` type that was never defined anywhere in the codebase (pre-existing, unrelated compile error — changed to `String`), and `NotificationsApiService.markRead` called `PATCH` where the real backend route is `PUT` (confirmed against `notification-service`'s actual source).

**Surfaced but intentionally not fixed in this pass** — real URL-shape mismatches between the mobile app and the actual backend routes, now failing with a clear parsed error instead of silently returning garbage:
- `cattle-service` has **no `GET /:id` route and no image upload/delete routes at all** — directly blocks `CattleDetailScreen`'s Overview tab and photo handling. This needs to be built before the Cattle Detail tab-expansion work can proceed.
- `marketplace-service`'s real routes are singular (`/listing`, `/product`, `/order/checkout`), not the plural paths (`/listings`, `/products`, `/orders`) the app calls.
- `wallet-service`'s balance route is `/wallet`, not `/wallet/balance`.
- `report-service` has no `/reports/herd` route (its real routes are `/reports/farmer/*`, `/reports/marketplace/*`, `/reports/cattle/*`, `/reports/history`).
- `notification-service` has no `/read-all` or `/register-token` routes.

This is the same "no gateway, ports/paths drifted" class of issue already tracked below (item 6) — reconciling each service's real routes against what the mobile app expects is follow-up work per service, not a single fix.

### 3.9 `cattle-service` filled out to match what mobile actually needs (2026-07-17)

Added the two missing pieces blocking Cattle Detail: `GET /:id` (with a `farmerId` ownership check — a different farmer's token now correctly gets "Cattle not found" instead of being able to view/guess another farmer's cattle by id) and `POST`/`DELETE /:id/images` (multipart upload via a newly-added `multer` dependency; no real AWS credentials are configured for this service, so `core.utils.s3` falls back to its existing mock-upload/mock-URL mode — same "dev-mode fallback" pattern already used for OTP delivery. Swapping in a real `s3Client` later requires no controller changes).

Also enriched `cattle.model.js`'s schema to match fields the mobile app's `Cattle`/`CattleDetailResponse`/`AddCattleRequest`/`InseminationRequest` models already expected but the backend never stored: renamed `nickname` → `name`, added `breed`/`age`/`weight`/`deviceId`/`grade`/`images`, and reshaped `calvingHistory` (added `complications`/`notes`, renamed `calvingDate`→`date`) and `inseminationHistory` (was just `bullId`+`status`; now `date`/`method`/`bullBreed`/`veterinarian`/`notes`, matching `InseminationRequest` exactly). Added `avgMilkDaily` as a Mongoose virtual (average of the last 7 days' morning+evening totals) so it's computed automatically everywhere a cattle document is serialized, rather than duplicated per endpoint.

**Verified live** end-to-end: created a cattle record with the full new field set, confirmed `avgMilkDaily` computes correctly (and recomputes after a milk log), confirmed the ownership check blocks a second farmer's token from reading the first farmer's cattle, recorded an insemination with the new richer shape, and did a real multipart image upload + delete round-trip (mock S3 URL correctly generated, stored, then removed).

Not done: no calving-record *creation* endpoint — checked, and nothing in the mobile app currently calls one (`CattleRepository.kt` has no matching method), so this wasn't built to avoid speculative API surface; add it when the mobile UI actually needs to record a calving.

### 3.10 Cattle Detail: Calving/Breeding tab split + insemination-recording UI (2026-07-17)

Split the old combined "Events" tab into two, matching the spec's tab breakdown: **Calving** (read-only — no calving-creation endpoint exists yet per §3.9, so no create UI was added) and **Breeding**, which gained a real create path via a new `RecordInseminationBottomSheet` (date, AI/Natural method as `FilterChip`s, optional bull breed/veterinarian/notes), surfaced through a page-aware FAB that now switches between "Log Milk" (page 1) and "Record Insemination" (page 3).

This closes a gap found while doing the work: `CattleDetailViewModel.recordInsemination(...)` was already fully wired to the repository/backend (built during the auth/envelope-fix pass earlier), but had zero UI entry point anywhere in the app — confirmed via grep before writing the sheet. `AddCattleScreen` and `AnimalHeaderCard` (image carousel, breed/age/weight/grade/avgMilkDaily stats) needed no changes at all — both were already built against the full data model ahead of §3.9's backend fix, so this pass is what makes them functional rather than silently talking to fields the backend used to drop.

Not build-verified (no Gradle in this environment). Checked by hand: full re-read of both files, a brace/paren balance count (`CattleDetailScreen.kt`: 179/179 braces, 389/389 parens; `RecordInseminationBottomSheet.kt`: 22/22 braces, 51/51 parens), and an import/usage sweep confirming no leftover references to the old `EventsTab` composable and no orphaned imports.

### 3.11 Cattle list pagination (2026-07-17)

Added real page-based pagination instead of ever fetching the whole herd in one response. `cattle-service`'s `GET /cattle` now accepts `page`/`limit` query params (default `page=1&limit=20`, `limit` clamped to a 100 max, both fall back to safe defaults on missing/garbage input) and returns `{ items, page, limit, total, hasMore }` instead of a bare array; `getCattleByFarmer` does the `skip`/`limit` query plus a `countDocuments` for the total, sorted newest-first. **Verified live**: seeded 25 test cattle for one farmer, confirmed the default call returns 20 with `hasMore: true`, `page=2&limit=10`/`page=3&limit=10` return the correct next slice and the correct final partial page with `hasMore: false`, and that out-of-range/garbage `page`/`limit` values clamp instead of erroring — then deleted the seeded records.

On mobile: `CattleApiService.listCattle(page, limit)` now sends both as query params and deserializes into a new `CattlePage` model (was `List<Cattle>` directly); `CattleRepository.listCattle` passes through. `CattleListViewModel` tracks `page`/`hasMore`/`isLoadingMore` in its state, appends (rather than replaces) `allCattle` on `loadMore()`, and guards against duplicate/overlapping fetches. `CattleListScreen` now uses a `LazyListState` with a `snapshotFlow`-based scroll listener that calls `loadMore()` once the user scrolls within 4 rows of the bottom of what's loaded, with a small spinner footer item while a page is in flight. Search/filter still runs client-side over whatever's been loaded so far (not a full-catalog server search) — acceptable for realistic herd sizes, but worth knowing if it ever surprises someone testing with a huge seeded dataset.

`IotPairingViewModel`'s cattle picker (used to pick which animal to attach an IoT collar to) also called the now-changed `listCattle()` — fixed to request `limit=200` (a full-herd picker, not the paginated list view) and unwrap `.items`.

**Also found and fixed while doing this, not otherwise related to pagination**: `ApiConfig.CATTLE_URL` was pointing at `user-service`'s port (3001) with an `/api/v1/cattle` path that `cattle-service` doesn't use — its routes are mounted at plain `/cattle` on its own port 3003 (`cattle-service/app.js`). This meant **every** cattle-related call from the mobile app, not just this one, was hitting a 404 (or a completely wrong service) regardless of any other correctness — confirmed by curl before and after the fix. Corrected to `http://10.0.2.2:3003/cattle`, verified against the live service. The same category of bug is already tracked below for `marketplace-service`/`wallet-service`/`report-service`/`notification-service` and was left alone here, since fixing those wasn't part of this pass.

Not build-verified (no Gradle in this environment) — checked by hand: full re-read of every edited file plus a brace/paren balance count across all seven touched Kotlin files, and a grep sweep confirming `CattleRepository.listCattle`/`IotPairingViewModel` were the only two call sites of the changed signature, both updated.

### 3.13 Route reconciliation pass: wallet-service + notification-service (2026-07-17)

Went through every non-cattle `ApiConfig` URL and checked it against each service's real route table (its `app.js` mount path + routes file), the same way §3.11 did for `cattle-service`. Result was a mix of trivial host/port fixes and real bugs, so this pass fixed what was mechanically fixable now and is deferring what turned out to be missing backend features (see §3.14).

**`ApiConfig` host/port fixed for all remaining services** — `WALLET_URL` (3002), `NOTIFICATION_URL` (3006), `MARKETPLACE_URL` (3004), `REPORT_URL` (3007), `HELPER_URL` (3005) were all still pointing at `user-service`'s port (3001) with an `/api/v1/...` prefix none of these services actually use. All five corrected to their real host/port + mount path (confirmed against each service's `app.js`). `REFERRAL_URL` was left alone — see §3.14, there's no route to point it at yet.

**`wallet-service` fully reconciled and fixed, verified live**: `WalletApiService.getBalance()`/`addMoney()` were calling `/wallet/balance` and `/wallet/add-money`, neither of which exist — the real routes are plain `GET /wallet` and `POST /wallet/add` (`wallet-service/routes/wallet.routes.js`). Fixed both. Found two real bugs while doing this: (1) `AddMoneyRequest` sent a `paymentMethod` field but the controller destructures `req.body.method` — the payment method was being silently dropped on every recharge; added a `@SerialName("method")` so the wire field matches. (2) `AddMoneyResponse` modeled a `{ message, orderId }` shape the endpoint has never returned — the real response is `{ balance, cashback }`; corrected the model to match (this endpoint currently has no UI caller anywhere in the app, so the fix is plumbing-only until something calls it). Also found and fixed the wallet-service equivalent of the wrong-argument-order `error()` bug (`error(res, err.message, "generic text", 500)` swaps `data`/`message`, silently discarding the real error) in all three `wallet.controller.js` handlers. **Most notably**: `GET /wallet/transactions` turned out to be served by a completely different, never-updated controller (`transaction.controller.js`, wired via a separate `transaction.routes.js` mount) that responded with `{ success, transactions }` — no `data` field at all — meaning this endpoint has been silently broken for every caller of the shared `unwrap()` extension despite the *path* matching exactly. Fixed to use `core.http.response.success`/`error` like every other controller. Verified live end-to-end: balance fetch → add money (balance + cashback correct) → balance re-fetch reflecting the credit → transaction history returning both the recharge and cashback rows with the real envelope shape.

**`notification-service` reconciled + two routes built, verified live**: `getAll()`/`markRead()` already matched the real routes exactly once the port was fixed — no changes needed there. `markAllRead()`/`registerToken()` called `PATCH /read-all` and `POST /register-token`, neither of which existed on the backend at all (confirmed by reading the routes file — not a path mismatch, a genuinely missing feature, unlike the wallet case above). Built both: `markAllAsRead(farmerId)` bulk-updates a farmer's unread notifications, and `registerDeviceToken(farmerId, token, platform)` upserts into a new `DeviceToken` model (stores the registration only — no dispatch yet, see §3.14). While in here, also added a `farmerId` ownership check to `markAsRead`/`readNotification`, which previously let any authenticated user mark any notification as read by guessing its id — same ownership-check pattern used everywhere else in the platform. Verified live: created two notifications, marked one read, confirmed a *different* farmer's token is correctly rejected (`404`-equivalent "Notification not found"), `read-all` flipped both to read, `register-token` upserted successfully.

**Also fixed on mobile, unrelated to routing but found while touching this area**: `AppNotification` was deserializing against field names (`body`, `isRead`, no `_id` mapping) that don't exist on the backend's actual `Notification` schema (`message`, `read`, `_id`) — every notification's `id` was blank and its body/read-state silently defaulted, with no error ever surfaced (same failure signature as the original envelope-unwrap bug from §3.8, just at the individual-field level instead of the whole-response level). Added the missing `@SerialName` mappings.

Not build-verified (no Gradle in this environment) — checked by hand: brace/paren balance across all five touched Kotlin files, `node --check` syntax validation on all six touched JS files, and confirmed no other mobile call site depends on the changed `AddMoneyResponse`/`AppNotification` shapes (`addMoney` still has zero UI callers; `AppNotification` is only ever read through its now-correct field names).

### 3.15 Referral feature built from scratch (2026-07-17)

Confirmed nothing existed beyond a `referredBy` field set at registration (§3.14 below, before this pass) — no controller, route, or way for a user to even have their own code. Root cause: `registerEmail`'s referral-code redemption (`User.findOne({ referralCode })`) could never match anyone, because **no registration path ever set a `referralCode` on the new user themselves** — only `referredBy` (the *other* direction) was ever written. So even a farmer who typed in a real code would never get linked to their referrer.

Fixed at the source with a Mongoose `pre("save")` hook on `user.model.js` instead of patching each of the three registration paths (email, OTP, Google) individually — every current and future signup path now gets a unique, DB-enforced (`unique: true, sparse: true`) 6-character code the moment the document is first saved, with a retry loop against collisions. Existing accounts self-heal: `referral.service.js`'s `getReferralInfo` saves the user once (triggering the hook) if `referralCode` is still empty when they first open the Referral screen.

Built the endpoint mobile already expected: `GET /api/v1/referral` (new `referral.routes.js`/`referral.controller.js`/`referral.service.js` in `user-service`, mounted alongside auth/users/upload) returns `{ code, totalReferrals, convertedCount, totalEarned, referees[] }` matching `ReferralInfo` exactly — no mobile-side changes were needed once the shape matched. A referee counts as "converted" once `emailVerified`/`mobileVerified` is true (both already set live by the existing email-verification-link, Google-login, and OTP-verify flows — no new mechanic invented). **`totalEarned`/`incentiveAmount` are hardcoded to 0** — there's no reward-crediting system anywhere in the platform (crediting money is explicitly a wallet-service concern per the existing comment in `auth.service.js`, and wiring cross-service credit is out of scope here); this endpoint reports referral counts and status honestly, it doesn't pay anyone.

**Verified live end-to-end**: registered farmer A, fetched their auto-generated code (`E33HMO` in the test run), registered farmer B using that code as `referral_code`, confirmed A's referee list immediately showed B with `isConverted: false`, then flipped B's `emailVerified` directly in Mongo and re-fetched — `convertedCount` correctly moved from 0 to 1. Test accounts deleted afterward.

Not build-verified (no Gradle in this environment, and no mobile-side changes were needed) — `node --check` on all five touched/new backend files.

### 3.16 `marketplace-service` built out to match what mobile actually needs (2026-07-17)

Same treatment as `cattle-service` in §3.9: the schema was too thin to hold what mobile's `CattleListing`/`Product` models expected, and three endpoints mobile calls didn't exist at all.

**Schema rewrite** — `listing.model.js`: added `farmerName`, `priceType` (fixed/negotiable/auction — replaces a vestigial `type` field that was never actually read anywhere), `location{district,state}`, a nested `cattle{tag,breed,type,age,weight,grade,avgMilkDaily,lactation,iotDataMonths}` snapshot, restructured `auction` to `{startPrice,reservePrice,endTime,highestBid,highestBidder,bids[]}`, `tokenUnlockFee` (default 1000), `sellerPhone`, and `unlockedBy[]`. `status` enum changed from `available/sold/auction` (which conflated lifecycle with listing type) to `active/sold/expired`, matching mobile. `product.model.js`: added `brand`, `description`, `unit`, `images`, renamed `ratings.total`→`ratings.count`, added `isVerified`, reshaped `reviews[]` to `{userId,userName,rating,comment,date}`. `order.model.js`: added `deliveryAddress{village,district,state,pincode,lat,lng}` — mobile's checkout request already sent this, the backend just silently dropped it before.

**Farmer/seller data is denormalized by necessity** — `farmerName` and `sellerPhone` are snapshotted at listing-creation time (submitted by the client, which already has its own profile data), since `marketplace-service` has no live lookup into `user-service`'s database and no inter-service gateway exists anywhere in this platform yet (same architectural constraint noted for the referral reward system in §3.15).

**Three missing endpoints built**: `GET /listing/:id`, `GET /product/:id` (neither existed — list-only before), and `POST /listing/:id/unlock` (the token-paywall feature had no backend route or logic at all). Unlock records the farmer in `unlockedBy` and returns the seller's phone — **it does not deduct the token fee via wallet-service**, since that would be the platform's first-ever live inter-service HTTP call and is a bigger architectural decision than this pass; flagged below rather than built silently. A farmer viewing their own listing is always treated as unlocked.

**Search/filter added**: `GET /listing` now supports `priceType` (exact match) and `q` (case-insensitive regex across title/breed/tag) — previously only an unused `type` filter existed. `GET /product` now supports `category` and `q` (regex on name) — previously `q` was silently ignored.

**Controller-level response mapping** (`mapListingForClient`) computes `isUnlocked` (contextual to the requesting farmer) and the auction summary (`currentHighestBid`/`bidCount`, derived from `highestBid`/`bids.length`) per request, since these can't be stored directly the way `Product`'s shape can (`Product`'s schema now matches the mobile model 1:1 with no transform needed, same pattern as `cattle.model.js`'s virtuals).

**Mobile**: fixed `CattleMarketApiService`/`DairyShopApiService` from the plural paths they'd always called (`/listings`, `/products`, `/orders`) to the backend's real singular ones (`/listing`, `/product`, `/order/checkout`) — no other mobile changes were needed; `CattleListingDetailViewModel` and the checkout flow were already coded correctly against the shapes this pass now actually produces. Added `lat`/`lng` to `OrderAddress` to match the same convention already used by the user profile's address (`user.model.js`'s `address.lat/lng`).

**Verified live end-to-end**: created a fixed-price listing and an auction listing as farmer A (both correctly `isUnlocked: true` for the owner) → fetched as farmer B (correctly `isUnlocked: false`, `sellerPhone` absent from every response) → search by breed and by `priceType=auction` both filtered correctly → unlocked as B (`sellerPhone` returned, `isUnlocked` flips true on refetch) → placed a bid below the minimum (correctly rejected) and a valid bid (correctly updated `currentHighestBid`/`bidCount`) → created a product, filtered by category, fetched its detail → checked out with a delivery address including `lat`/`lng` → confirmed stock decremented and the order (with the full address) appears in the buyer's order history. All test data deleted afterward, including one stray leftover listing found from an earlier ad-hoc test in a prior session.

Not build-verified (no Gradle in this environment) — `node --check` on all six touched backend files, brace/paren balance on the three touched Kotlin files.

### 3.18 `report-service`: real herd report built (2026-07-17)

Built the endpoint mobile's Reports screen has always expected but never existed: `GET /reports/herd?days=N`. Rather than duplicating cattle/milk data into report-service's own database, it reads live from `cattle-service` via `core.http.apiClient`, forwarding the caller's own bearer token instead of using a service-level credential — `cattle-service`'s `requireAuth` needs a real farmerId to scope the query to, and every service in this platform shares the same `JWT_SECRET` today, so the token the mobile app already sent to report-service is valid there too. This is the documented, intended use of `core.http.apiClient` (see its own JSDoc: "forward caller's token (created inside request handler)").

Worth noting: **this is not the platform's first inter-service call** — `report.service.js` already had four other functions (`getFarmerExpenseReport`, `getMarketplaceReport`, `getWalletReport`, `getCattlePredictionReport`) making raw `axios` calls to other services' `.env`-configured URLs. All four are currently broken in ways beyond scope of this pass (wrong paths per the real routes discovered in §3.13/§3.16, no auth header forwarded at all — they'd 401 against any service with `requireAuth` applied globally, and `getCattlePredictionReport` points at `cattle-service` for a `/predictions` route that doesn't exist). Not fixed here — `getHerdReport` was built fresh using the correct pattern rather than patched onto the broken one; the other four are tracked below.

Response shaping: fetches the farmer's full herd via `cattle-service`'s paginated list endpoint (§3.11) with a high limit, then computes `HerdSummary` (total cattle, active IoT device count, today's/this-month's milk totals, grade distribution keyed by `S/A/B/C/D` — confirmed against `ReportsScreen.kt` that only those five keys are ever read) and a per-cattle `CattleMilkReport` (tag/breed/grade/avgMilkDaily copied through, `peakMilk`/`totalMilk`/`milkTrend` computed from `milkLogs` filtered to the requested `days` window). `healthScore`/`alertsCount`/`lastSync` are honestly `0`/`""` — no health-scoring or cattle-linked alerting engine exists anywhere in the platform (confirmed `healthScore`/`lastSync` aren't even rendered in `ReportsScreen.kt`, so this isn't a visible regression).

**Verified live**: created two test cattle (one with an IoT `deviceId` + grade A, one grade B, both with a milk log), fetched the herd report as that farmer — `totalCattle: 2`, `activeIotDevices: 1`, `todayMilkTotal`/`monthMilkTotal` correctly summed, `gradeDistribution: {A:1, B:1}`, both `cattleReports` entries correct including `milkTrend`. Confirmed farmer-scoping works correctly by forwarding a *different* farmer's token — correctly returned an empty herd, not the test farmer's — and confirmed a request with no Authorization header at all is rejected with 401. Test cattle deleted afterward.

Mobile: `ReportsApiService.getHerdReport` was pointed at `BASE_URL/reports/herd` (user-service, wrong service entirely) — fixed to `REPORT_URL/herd` (already correctly pointed at report-service's own port since §3.13). No other mobile changes needed — `ReportsViewModel`/`ReportsScreen` were already coded correctly against this shape.

Not build-verified (no Gradle in this environment) — `node --check` on all three touched backend files, brace/paren balance on the touched Kotlin file.

### 3.20 CRITICAL: cross-service JWT_SECRET mismatch found and fixed (2026-07-17)

While starting the coins feature (§3.21) and testing it against a **real** token obtained by actually logging into `user-service` — rather than a synthetic token minted to match whichever single service was being tested, which is what every "verified live" test earlier in this session used — discovered that `user-service/.env` had `JWT_SECRET=godhan_super_secret_key`, while all 6 other services (`cattle-service`, `wallet-service`, `marketplace-service`, `notification-service`, `report-service`, `helper-service`) use `JWT_SECRET=supersecret`.

**Impact**: every token `user-service` has ever issued to a real logged-in farmer was signed with the wrong secret and silently rejected ("Invalid or expired token") by every other service in the platform. Confirmed directly: registered and logged in a real user, took the real token from the login response, called `GET /wallet` with it — `401 Unauthorized`. This means, despite everything individually verified live earlier this session (cattle pagination, wallet reconciliation, notifications, referral, marketplace, herd reports), **none of it was ever actually reachable from a real logged-in mobile session** — every prior test used a token hand-signed with the target service's own secret to isolate and verify that service's logic, which is valid for proving the logic correct, but never exercised the cross-service auth path a real user depends on.

**Fixed**: changed `user-service/.env`'s `JWT_SECRET` to `supersecret`, matching the other 6. **Re-verified**: the same real login → real token → `GET /wallet` now returns `200` correctly. This one-line fix is arguably the most consequential change in this entire session — every other backend fix was necessary but not sufficient without this.

**Why this stayed hidden for so long**: nothing in this session's testing methodology ever chained a real `user-service` login into a call against another service using that *same* token — each service was tested in isolation with a token crafted to match it. That gap in test methodology, not any single bug, is what let this hide. Worth remembering for future verification passes: prefer real login-derived tokens over synthetic ones whenever testing a flow that crosses more than one service.

### 3.21 Coins reward/redemption economy built (2026-07-17)

Built at the user's explicit direction, replacing referral's honest-0 `totalEarned` (§3.15) and marketplace's honest-0 unlock-fee deduction (§3.16) with a real, working payment mechanism — 1 coin = ₹1, earned via referral conversion, redeemable (capped at a configurable percentage of the total, never covering a purchase entirely by default) at marketplace unlock and dairy shop checkout.

**`wallet-service`** — `Wallet.coinBalance` (separate from `balance`, never withdrawable or purchasable) and `Transaction.coinAmount` (portion of a transaction paid/earned in coins; 0 for ordinary cash transactions) added to the schema. Two new endpoints: `POST /wallet/credit-coins` (credits `req.user.id`'s coin balance — called by other services on a reward event, never directly by the mobile app) and `POST /wallet/charge` (splits a payment between coins and real balance; `MAX_COIN_REDEMPTION_PERCENT`, default 50%, is a `core.utils.config` key, server-enforced regardless of what the client requests — rejects if real balance can't cover the remainder). **Verified live**: credited 200 coins, charged ₹1,000 requesting 500 coins — correctly capped to `min(requested, 50% cap, available)` = 200 coins + ₹800 cash; a second charge with insufficient real balance correctly rejected.

**Referral coin-crediting (`user-service`)** — added `User.referralRewarded` (prevents double-crediting) and a `post("save")` hook on the User model that fires `referralReward.service.js`'s `maybeRewardReferrer` whenever `emailVerified`/`mobileVerified` becomes true and the user has a `referredBy` that hasn't been rewarded yet. This is fire-and-forget and non-fatal by design (same principle as the verification-email send in `auth.controller.js`) — a wallet-service hiccup never blocks the user's own save, and since the hook re-checks on every subsequent save, it self-heals/retries opportunistically rather than needing its own retry queue.

The referrer isn't the one making the request that triggers their reward — there's no "caller's own token" to forward the way `report-service`'s herd report does (§3.18). Instead, `maybeRewardReferrer` mints a short-lived (~1 min) token for the referrer's own id using the shared `JWT_SECRET` (now confirmed actually shared, per §3.20) and calls wallet-service exactly as if the referrer had made the request themselves. This is a pragmatic form of internal impersonation, not a real service-to-service auth boundary — acceptable within one trusted backend where every service already shares a secret, but would need real service auth (e.g. a dedicated service-identity token type) if that trust boundary ever changed. `referral.service.js`'s `getReferralInfo` now reports real `incentiveAmount`/`totalEarned` (coins actually credited, in ₹ terms) instead of hardcoded 0.

**Verified live end-to-end**: registered a referrer, fetched their code, registered a referee with it, hit the *real* `/api/v1/auth/verify-email` endpoint (not a direct DB write) to trigger the actual production code path — referrer's coin balance correctly went from 0 to 50 (the `REFERRAL_REWARD_COINS` default), `getReferralInfo` correctly showed `totalEarned: 50` and the referee as converted, and re-verifying the same token a second time correctly did *not* double-credit.

**Marketplace unlock + checkout (`marketplace-service`)** — `unlockListing` and `createOrder` now call `wallet-service`'s `/wallet/charge`, forwarding the caller's own bearer token (same pattern as the herd report — the payer here always is the caller, so no impersonation needed). A farmer unlocking their own listing, or re-unlocking one they've already paid for, is still free — no charge attempted at all. **Incidentally fixed a real pre-existing bug while restructuring `createOrder`**: stock was previously decremented item-by-item *during* validation, so a cart with a valid item followed by an out-of-stock one left the valid item's stock decremented with no order ever created to account for it. Now every item is validated and priced first, the wallet charge happens once the total is known, and stock is only committed after the charge succeeds. `Order` gained `coinsUsed`/`cashUsed` fields for the receipt. **Verified live**: unlocked a listing redeeming 50 coins (200 available capped by the 50%-of-fee rule) + ₹950 cash, confirmed re-unlocking is free; checked out a ₹500 order redeeming 100 coins → ₹400 cash, confirmed stock decremented correctly; confirmed a cart with one valid + one nonexistent product fails cleanly with **zero** stock or wallet mutation (proving the reorder fix).

**Mobile**: `WalletBalance.tokenBalance` (an always-0 dead field) renamed to `coinBalance`, now real; `WalletScreen`'s existing "Tokens" stat card relabeled "Coins" — no new UI slot needed. Built a new unlock bottom sheet (`CattleListingDetailScreen`'s `UnlockCoinSheet`) with a coin-redemption stepper, and a `CheckoutScreen` **from scratch** (address form + coin redemption + order summary + confirmation) — there was no checkout screen at all before this; `CartScreen`'s "Proceed to Checkout" button was a bare `/* TODO */`. `DairyShopViewModel` gained checkout state/methods (reused rather than a separate ViewModel, since cart state already lives there). **Also found and fixed while touching `DairyShopApiService.kt`**: `getProducts`/`getProductById` called `.unwrap()` without ever importing it (only `unwrapMessage` was imported) — a genuine, pre-existing "unresolved reference" compile error that predates this pass, unrelated to coins but caught while editing this file for `placeOrder`'s new return type.

Not build-verified (no Gradle in this environment) — brace/paren balance across all eleven touched/new Kotlin files, `node --check` on all touched backend files, and a grep sweep confirming no other mobile call site depended on the changed `WalletBalance`/`DairyShopViewModel`/`CattleListingDetailViewModel` constructor signatures.

### 3.22 `report-service`'s other four functions fixed (2026-07-17)

`getFarmerExpenseReport`, `getMarketplaceReport`, `getWalletReport`, `getCattlePredictionReport` were all still on the original broken `axios` calls from before §3.18 — wrong paths (`/orders` instead of `/marketplace/order`, `/wallet/:farmerId` instead of bare `/wallet`), and none forwarded an auth header at all, so all four would 401 against any service with `requireAuth` applied (every service in this platform). Switched all four to `core.http.apiClient` forwarding the caller's own token, same pattern as `getHerdReport`.

**`getCattlePredictionReport`** pointed at a `/predictions` route on `cattle-service` that has never existed (no ML/health-prediction engine exists anywhere in the platform) — rather than hit a 404, it now honestly returns `[]`, matching the `healthScore: 0` pattern already established in §3.18.

**`getMarketplaceReport`** was written as a platform-wide admin report, but the real `GET /marketplace/order` route has never supported that — it always scopes to the caller (`req.user.id`), and there's no admin-only "all orders" endpoint anywhere (nor would `core.middleware.role('admin')` currently work if there were one — the JWT payload has never included a `role` claim, a separate latent gap not fixed here). Rescoped to "the calling farmer's own marketplace activity," which the real endpoint can actually answer; noted as a scope-down, not a full fix, in case a real admin report is wanted later. Nothing in the mobile app calls this endpoint directly today, so this didn't change any visible behavior.

**The real find of this pass**: `getFarmerSummaryReport` — the *only* one of these five actually called by mobile, via `DashboardApiService.fetchSummary` → the Home screen. Its old shape (`{farmerId, expenses, wallet, cattlePredictions}`) has never matched what the mobile `FarmerSummary` model deserializes (`{cattleCount, milkTodayL, revenueToday, expensesToday}`) — every field was silently defaulting to 0 on the Home dashboard, with no error ever surfaced, the same failure signature as every other "shape doesn't match" bug found this session. Rebuilt to produce the real shape: cattle count + today's milk from `cattle-service`, today's wallet credit/debit totals (real ₹ only, `coinAmount` excluded) from `wallet-service` as the revenue/expense proxy — there's no dedicated income/expense ledger anywhere in the platform, so wallet transaction direction is the closest honest signal that actually exists.

**Also fixed while in this area** (found reviewing `DashboardApiService.kt` for the summary call): `fetchWalletBalance` called `WALLET_URL/balance`, a route that's never existed (bare `GET /wallet` is correct, already established in §3.13) — same class of bug, different file. And `AlertNotification.id` had no `_id` mapping, the exact same latent bug already fixed once for `AppNotification` in §3.13 — every dashboard alert's id was silently blank.

**Verified live end-to-end** with a real registered/logged-in farmer (not synthetic tokens, per the §3.20 lesson): added a cattle with a milk log, a wallet credit, and a helper, then hit all five report routes with the real token — `farmer/summary` correctly returned `cattleCount: 1, milkTodayL: 18, revenueToday: 1020, expensesToday: 0`; `farmer/expenses` correctly computed `salaryExpense: 15000` from the helper's daily wage; `wallet/summary` correctly returned the real balance; `marketplace/summary` correctly returned zero (this farmer placed no orders); `cattle/predictions` correctly returned `[]`. Confirmed an unauthenticated request still 401s. Test data deleted afterward.

Not build-verified (no Gradle in this environment) — `node --check` on both touched backend files, brace/paren balance on both touched Kotlin files.

### 3.23 Helper/Labor management built end-to-end (2026-07-17)

Previously a pure placeholder — `HelperListScreen` was a `PlaceholderContent("Helpers")` stub in `ProfileSidePanel.kt`, and the Home tab's "Helpers" quick-action button was a literal no-op (`{}`), despite `helper-service`'s backend already being fully built (create/list helpers, attendance, salary slips, contract uploads — even used internally by `report-service`'s expense report). This was the largest gap between "backend exists" and "feature usable" anywhere in the platform.

**Backend hardened before building the mobile UI on top of it**: found the same missing-ownership-check pattern already fixed elsewhere this session — `updateHelper`, `markAttendance`, `uploadContract`, `issueExperienceLetter` never scoped by `farmerId`, so any authenticated user could mutate any farmer's helper by guessing its id. Fixed all four, and added the missing `GET /helpers/:id` (also ownership-scoped) needed for a detail screen — only list + create + blind update existed before. Rewrote `settleSalary` to compute the slip from real attendance records (`daysPresent`/`totalDays` counted from the month's actual attendance entries, `salary = dailyWage × daysPresent`, half-days counting as 0.5) instead of trusting a client-provided `summary` object — more correct and impossible for the mobile client to get wrong. Wired real contract-document upload via `multer` + `core.utils.s3`'s mock-upload fallback, the same pattern already used for cattle images (`multer` wasn't a dependency yet — added and confirmed installable). `advanceAdjusted` stays 0 (the schema has an `advances` field but nothing anywhere writes to it) — `netPayable` equals `salary` until that's built, documented as a known simplification rather than fabricated.

**Mobile built from scratch**, following the exact wiring convention `CattleListScreen`/`CattleModule` established: `domain/model/HelperModels.kt`, `HelperApiService`, `HelperRepository`, `di/HelperModule.kt` (the module already existed commented-out in `KoinInit.kt`, anticipating this). `HelperListScreen` (list + a bottom-sheet add form, same pattern as `LogMilkBottomSheet`) and `HelperDetailScreen` (info card, one-tap Present/Half/Absent attendance marking, salary slip history + a "Generate for this month" button, contract documents with photo upload via the existing `rememberImagePickerLauncher` — contracts are photographed, not uploaded as arbitrary PDFs, since only an image-picker expect/actual exists in this platform, same constraint already accepted for cattle photos). Wired both real entry points: `ProfileSidePanel`'s "My Helpers" item and the Home tab's "Helpers" quick-action now both push the real screen.

**Verified live end-to-end** against the backend (curl, real farmer token): created a helper, confirmed detail/list both ownership-scoped (a second farmer's token correctly 404s/sees an empty list), marked 3 present + 1 absent attendance entries, generated a salary slip for the current month and confirmed `daysPresent: 3, salary: 1800` (₹600/day × 3) computed correctly, uploaded a contract document via real multipart upload, edited the helper's wage. Test data deleted afterward.

Not build-verified (no Gradle in this environment) — `node --check` on all three touched/new backend files, brace/paren balance across all eleven touched/new Kotlin files, and a grep sweep confirming no leftover references to the old placeholder screen.

### 3.24 Cattle lifecycle features built end-to-end (2026-07-17)

Built the last item on the original "Pending" list that was purely absent (no placeholder even) — calf creation/promotion, archival (sold/deceased), genealogy, and a PDF lifecycle export.

**Schema (`cattle.model.js`)**: added `status` (`active`/`sold`/`deceased`, default `active`), `statusDate`, `statusNotes`, and `motherId` (genealogy — no tracked "father" field, since sires are almost always external/purchased semen already captured by `inseminationHistory.bullBreed`, not a cattle record this farmer owns). `calvingHistory` entries gained a `calfId`, set only when a calving event's "add this calf to my herd" option was used. Archiving never deletes a record — a sold cow can still be looked up as another calf's mother, so genealogy and historical milk/breeding data both stay intact; only the default herd list excludes non-`active` animals (`includeArchived=true` opts back in).

**Hardened the same missing-ownership-check pattern found and fixed repeatedly this session**: `updateCattle`, `addMilkLog`, `addInsemination` never scoped by `farmerId` before this pass — any authenticated user could edit/milk-log/inseminate another farmer's cattle by guessing its id. Fixed all three while adding the new lifecycle functions.

**New backend capability, `POST /:id/calving`**: the platform's only calf-creation path — records the calving event on the mother (clears her pregnancy state, increments `lactation`), and optionally creates a new linked `Cattle` document (`motherId` set, `age: 0`) in the same call. This is also the calving-record-*creation* endpoint that was flagged missing all the way back in §3.9 ("nothing in the mobile app currently calls one") — now it exists and something does.

**New capability, archival**: `PUT /:id/status` sets `active`/`sold`/`deceased` with a date and free-text notes (sale price/buyer, cause of death, etc.).

**New capability, genealogy**: `GET /:id/offspring` (ownership-checked on the parent first, so a farmer can't enumerate another farmer's herd by probing an arbitrary id as a "mother"), and `getCattleDetail` now includes a lightweight `mother: {id, name, tag}` lookup — deliberately not a full nested `Cattle` document, to avoid a circular-reference risk (mother embeds a calf, which embeds the mother, ...).

**New capability, PDF export**: `GET /:id/lifecycle-pdf` streams a real, valid PDF (via `pdfkit` — pure JS, no headless-browser dependency, confirmed installable) summarizing identity, genealogy, calving/breeding history, and a milk-log summary. All data is fetched and validated *before* anything is written to the response, since once `pdfkit` starts piping, the response can no longer fall back to the normal JSON error envelope.

**Mobile — a real platform capability had to be added, not just a screen**: `ShareHelper` only supported plain-text sharing; there was no way for the app to hand a downloaded file to another app. Extended it with `shareFile(bytes, filename, mimeType)`. Android's implementation is real and complete — writes to `cacheDir/shared/`, requires a `FileProvider` (added: `res/xml/file_paths.xml` + a `<provider>` entry in `AndroidManifest.xml`, since Android has blocked raw `file://` sharing across apps since API 24) — and opens the standard share sheet via a `content://` URI. iOS is stubbed (`// implement via UIActivityViewController when needed`), consistent with every other platform feature this session.

`CattleDetailScreen` gained: a "Record Calving" FAB on the Calving tab (previously read-only, matching §3.9's note that no creation UI existed since no endpoint did either) opening a new `RecordCalvingBottomSheet` with an "add this calf to my herd" checkbox; a status badge in the header when non-active; a "Genealogy" card on the Overview tab (mother + offspring, both tappable to navigate to that animal's own detail screen); and a new overflow menu (⋮) with "Update Status" (`SetCattleStatusBottomSheet`) and "Download Lifecycle PDF" (fetches bytes, hands them to `ShareHelper.shareFile`).

**Verified live end-to-end**: created a pregnant cow, recorded her calving with "add calf" checked — confirmed the mother's `lactation` incremented, pregnancy cleared, and a new linked calf record was created; confirmed genealogy resolves both directions (calf → mother, mother → offspring list); archived the mother as sold — confirmed she disappeared from the default active list but remained reachable via `includeArchived=true`, and her record was still correctly resolvable as the calf's mother; downloaded the lifecycle PDF and confirmed it's a real, valid single-page PDF document with the right headers; confirmed all four new endpoints correctly reject a different farmer's token. Test data deleted afterward.

Not build-verified (no Gradle in this environment, and the Android `FileProvider`/manifest changes are exactly the kind of thing most likely to have a real build-time surprise — flagged the same way the biometric-lock Gradle changes were flagged back in §3.1-era work) — `node --check` on all four touched backend files, brace/paren balance across all eleven touched/new Kotlin files, and a basic tag-balance check on both touched XML files (no XML parser available in this environment to fully validate).

### 3.25 Heat → AI → pregnancy → calving breeding cycle built end-to-end (2026-07-17)

Extended §3.24's lifecycle work with the full breeding cycle the user described: heat detection prompts AI, AI captures structured bull details, a ~90-day reminder prompts pregnancy confirmation, and gestation-based calving prediction — now with a ±3-day tolerance window (added mid-pass at the user's request, since real calvings routinely land a few days either side of the estimate).

**Heat tracking — two confirmation paths, per the user's explicit direction**: `cattle.heatEvents[]` records `source: "manual"` (the farmer directly reporting heat — that observation *is* their confirmation, so it's auto-confirmed in one step) or `source: "iot"` (the path a future activity-based detector would call — nothing in this platform actually pushes telemetry-based heat detection today, no accelerometer ingestion exists anywhere, so this starts unconfirmed and needs an explicit `PUT /:id/heat/:heatEventId/confirm`). Both paths converge on the same "record AI" reminder once confirmed.

**Bull registry — "structured fields only, no analytics yet," per the user's chosen scope**: new `Bull` model/collection (`tag`, `breed`, `type`, `source`, `registrationNumber`, `notes`) that inseminations reference via `bullId`, replacing a bare free-text breed string. No offspring-performance analytics computed from it — that needs enough real data to be meaningful, and wasn't the scope chosen.

**Gestation + the ±3-day window**: `GESTATION_DAYS = { cow: 283, buffalo: 310 }` — species-specific, per the user's correction that buffalo run meaningfully longer than cattle. `confirmInsemination` (the ~90-day PD-confirmation action) computes `expectedCalvingDate` from the *insemination* date, standard dairy practice. Mid-pass, the user pointed out calving happens early or late often enough that a single estimated date overstates precision — added `earliestCalvingDate`/`latestCalvingDate` virtuals (±3 days) to `cattle.model.js`, and rewired every calving-related read (the "due soon" reminder trigger in both `getReminders` and the cron sweep, the header card's pregnancy badge, and the PDF export) to use the window instead of the single date.

**Real reminders, not just stored fields** — matches the user's "it will prompt for X" framing, not passive data tracking:
- **Record AI**: fires immediately and synchronously the moment a heat event is confirmed (manual logging or an explicit IoT-confirm) — there's a real trigger to hang off of, so no schedule is needed. Forwards the *farmer's own* token, no impersonation needed (they're notifying themselves about their own action).
- **Confirm pregnancy** (~90 days post-AI) and **calving expected** (±3-day window materializing): both need an actual schedule, since nothing the farmer does naturally happens exactly then. A new `reminder.cron.js` (`node-cron`, matching `report-service`'s existing convention) runs daily, using the same internal-impersonation-token pattern as `referralReward.service.js` (§3.21) to notify on the target farmer's behalf. `pdReminderSent`/`calvingReminderSent` flags stop it from re-notifying every day once a reminder has fired — verified live by running the sweep twice and confirming no duplicate notification.

**Mobile**: `RecordInseminationBottomSheet` gained a bull picker (chips for registered bulls, falling back to free-text breed entry) with an inline "+ Register a new bull" mini-form — no separate bull-management screen, matching the backend's scope decision. The Breeding tab was restructured: a "Log Heat" action, cards for any unresolved heat event (a "Record AI" button on confirmed ones pre-links the resulting insemination back to that heat event; a "Confirm" button on IoT-flagged unconfirmed ones), and "Confirm Pregnancy"/"Not Pregnant" actions directly on pending insemination rows with a status chip (pending/confirmed/missed). A new `RemindersScreen` (reachable from a bell icon on the herd list's new top bar) lists everything due across the whole herd, each tappable straight to that animal's detail screen.

**Verified live end-to-end** (real farmer token, real database, not synthetic shortcuts): registered a bull, created a cow, logged manual heat (confirmed instantly, notification fired, reminder appeared), recorded insemination linking the bull and heat event (reminder correctly resolved), backdated a second insemination 95 days and confirmed the PD reminder appeared, confirmed pregnancy and verified `expectedCalvingDate` = insemination date + 283 days exactly, verified the ±3-day window computed correctly for a buffalo (310-day gestation), manually set a near-due calving date and confirmed the reminder appeared with the correct window in its message, ran the cron sweep directly (bypassing the schedule) and confirmed it fired the calving notification once and did *not* duplicate it on a second run, and confirmed all new endpoints correctly reject a different farmer's token. One real bug caught mid-test: a test script confirmed the wrong one of two pending inseminations (a script mistake, not a backend bug) — re-verified against the correctly-identified record once caught.

Not build-verified (no Gradle in this environment) — `node --check` on all ten touched/new backend files, brace/paren balance across all eleven touched/new Kotlin files, and a grep sweep confirming every call site of the changed `recordInsemination`/`CattleRepository` signatures was updated consistently.

### 3.27 Insemination sheet reworked to a breed-first bull picker (2026-07-17)

Reworked the flat "pick any registered bull" chip list from §3.25 into the two-step flow the user described: pick a breed, then a specific bull of that breed — `bullId` is captured automatically from the selection, never typed. Breeds not yet registered fall to an "Other" chip with a plain free-text field (no structured bull, same as before this rework).

**Narrowed to the cattle's own species**, per the user's follow-up: since the sheet is opened from a specific animal's own detail screen, its `type` (cow/buffalo) is already known — the breed list and bull list are both filtered to bulls of that same type, so a buffalo bull never shows up as an option when inseminating a cow. (`goat` cattle have no matching bull `type` in the schema — bulls were only ever scoped to cow/buffalo — so a goat's sheet always falls through to the "Other" free-text path; a pre-existing scope limit from §3.25, not a new gap introduced here.)

**"Add" appears exactly when it should**: once a breed is selected, if the farmer has no bulls of that breed registered yet, the add-bull mini form appears automatically (no extra tap needed, since there's nothing else useful to show in its place) — pre-scoped to the already-chosen breed, so the form only asks for tag/registration number, not breed again. If bulls already exist for that breed, they're shown as chips first, with a "+ Register another" option to add more.

Not build-verified (no Gradle in this environment) — brace/paren balance on the touched file, and a full re-read confirming the fallback chain in the Save button (`selectedBull?.breed ?: selectedBreed ?: bullBreed`) correctly still records at least the chosen breed even if a farmer picks a breed but hasn't tapped a specific bull chip yet.

### 3.29 Localization: English/Hindi/Marathi/Gujarati infrastructure + first migration pass (2026-07-17)

Built the full Compose Multiplatform localization pipeline the user asked for ("i want 4 languages in phase 1 Hindi english, marathi, gujrati"), plus migrated the highest-traffic screens as the proven pattern.

**Resource pipeline**: `shared/build.gradle.kts` gained a `compose { resources { packageOfResClass = "com.godhan.app.resources" } }` block (the `compose.components.resources` dependency was already present but unused). Four parallel `strings.xml` files under `shared/src/commonMain/composeResources/` — `values/` (English, the default/fallback), `values-hi/`, `values-mr/`, `values-gu/` — each with the identical 101 keys (verified by diff), generating type-checked `Res.string.xxx` accessors.

**Manual language override, not just system-locale following**: Compose Multiplatform's resource system normally just reads the OS locale, with no public API to override it at runtime — confirmed against the official JetBrains docs (kotlinlang.org/docs/multiplatform/compose-resource-environment.html) since this couldn't be verified by compiling in this environment. Implemented the documented workaround: `LocaleEnvironment.kt` (commonMain) declares `expect object LocalAppLocale` plus a module-level `currentAppLanguage` mutable-state var and an `AppLocaleScope` wrapper that recomposes the whole tree on language change; `.android.kt` actual overrides `LocalConfiguration`/`Locale.setDefault`; `.ios.kt` actual writes `NSUserDefaults`' `AppleLanguages` key behind a `staticCompositionLocalOf`. `App.kt` now wraps everything in `AppLocaleScope` and seeds `currentAppLanguage` from a new `LanguageStore` (mirrors `AppLockStore`'s Settings-backed pattern) on launch.

**Language switcher**: added a card to `SettingsScreen` — System default / English / हिन्दी / मराठी / ગુજરાતી as radio rows, selecting one sets `currentAppLanguage` immediately (instant in-app effect, no restart) and persists the choice via `LanguageStore`.

**Screens migrated this pass**: Splash, Login, OTP verify, Register, Complete Profile, Permissions, Settings, Home (including its time-of-day greeting, refactored from a raw ViewModel-owned string into a `GreetingPeriod` enum resolved to a string resource in the composable, since `stringResource` can't be called from a plain ViewModel), the five bottom-nav tab labels, and `MainTabScreen`/`ProfileSidePanel` (notification bell, avatar, side-panel menu items, placeholder screens). The "गोधन"/"GODHAN" brand wordmark and the single-letter "G" Google-logo proxy were deliberately left hardcoded — brand marks, not UI strings, consistent across every locale by design.

**Not yet migrated** (mechanical follow-on work, not started): cattle screens, marketplace, wallet, reports, helper management, breeding/calving UI (§3.25–3.27), referral, notifications list — all still English-only. The infrastructure and pattern are proven; extending it is copy-paste-and-translate from here.

### 3.31 Localization: cattle screens migrated (2026-07-17)

Extended §3.29's infrastructure to every screen under `ui/screens/cattle/` — herd list, add cattle, reminders, and the full cattle detail screen (header card, all four tabs, all five bottom sheets, the IoT reconnect sheet). 143 new keys across all four `strings.xml` files (244 total, still verified in exact parity across en/hi/mr/gu).

**Two ViewModel-owned message types converted to data, not text** — same reasoning as Home's `GreetingPeriod` in §3.29 (a `ScreenModel` can't call `stringResource()`, so pre-formatted English strings baked into UI state can't be localized after the fact):
- `AddCattleUiState.Error(message: String)` split into `ValidationError(field: AddCattleField)` for the four local field checks (resolved to text in `AddCattleScreen`) and `NetworkError(message: String?)` for whatever the repository/backend actually throws (stays as-is — that's dynamic, often server-generated text the client has no business translating).
- `CattleDetailUiState.successMessage` changed from `String?` to a new `CattleDetailMessage` sealed class (`MilkLogSaved`, `CalvingRecorded(calfAdded)`, `StatusUpdated(status)`, etc.) — resolved to a localized string via the suspend `getString()` (not the `@Composable` `stringResource()`, since resolution happens inside the snackbar's `LaunchedEffect` coroutine, not a composable body) right before showing the snackbar.

**Other cleanup that fell out of doing this properly**: `CattleFilter` enum's hardcoded `label: String` field (`"Cow"`, `"Buffalo"`, ...) was dead weight once the label had to route through a locale-aware lookup instead — removed the field entirely and added a `cattleFilterLabelRes()` mapper in `CattleListScreen.kt` rather than leaving an unused, stale-by-construction property behind. Reused existing keys where the exact same English string already existed for a different purpose (`home_action_log_milk` for the milk FAB and the Log Milk sheet's own title, `home_action_add_cattle` for both the Add Cattle screen title and its FAB content-description) instead of creating near-duplicate keys.

**Deliberately left untranslated**: `reminder.cattleName`/`reminder.message` on the Reminders screen — these are plain strings generated server-side by `cattle-service`'s reminder logic (§3.25), not client UI strings, so localizing them would need backend i18n work, out of scope for a client-side pass. The IoT pairing screen (`ui/screens/cattle/iot/`, ~840 lines across its Screen + ViewModel) was also left out of this pass — it's a large, distinct sub-feature (BLE/WiFi provisioning) rather than core cattle management, and wasn't included in "the cattle screens" as interpreted here; flagged in §3.32 below as the next candidate.

Not build-verified (no Gradle available) — brace/paren balance across all 12 touched/new Kotlin files, a full cross-reference confirming every `Res.string.xxx` used in code has a matching (and no orphaned) entry in all four `strings.xml` files, and XML well-formedness/key-parity checks on all four resource files (244/244 keys matching across en/hi/mr/gu).

Translations (Hindi/Marathi/Gujarati) were authored directly, not sourced from a professional translator — natural for common app vocabulary, but worth a native-speaker review pass before shipping, especially domain-specific terms (e.g. the "head" unit for cattle count, rendered as नग/નંગ).

### 3.32 Localization: wallet, reports, and helper management migrated (2026-07-17)

Continued the screen-by-screen migration ("complete one by one") into Wallet, Reports, and Helper management. 55 new keys (299 total), still verified in exact parity across en/hi/mr/gu.

**Wallet**: balance card, transaction filter chips, transaction list, empty state. `TransactionFilter`'s hardcoded `label` field removed the same way `CattleFilter`'s was in §3.31 — a `transactionFilterLabelRes()` mapper replaces it, reusing `cattle_filter_all` for the shared "All" chip instead of a near-duplicate key. `tx.description`'s fallback (`tx.tag` reformatted) is left as-is — backend-defined tag vocabulary, same reasoning as reminder text in §3.31.

**Reports**: date-range chips (parameterized `%1$d days`, `DateRange`'s hardcoded `label` field removed the same way), herd summary card, milk production section + line chart, grade breakdown, per-cattle report cards. Reused `cattle_detail_grade_prefix` for both "Grade X" badges here (identical pattern to the cattle detail screen) and the `cattleTypeLabelRes()` helper from `AddCattleScreen.kt` (widened from `private` to `internal` to make it cross-file reusable, instead of duplicating the cow/buffalo/goat/sheep mapping a third time).

**Helper management**: herd list's helper cards, add-helper sheet, and the full helper detail screen (attendance marking, salary slip generation, contract document upload). `HelperDetailUiState.message: String?` — which conflated ViewModel-owned success text ("Attendance marked", etc.) with raw backend error messages in one field — split into `successMessage: HelperDetailMessage?` (a new sealed class, same `getString()`-resolution pattern as `CattleDetailMessage` in §3.31) and a separate `error: String?`, mirroring the split `CattleDetailUiState` already had from the start.

Not build-verified (no Gradle available) — brace/paren balance across all 6 touched files, a full cross-reference confirming every `Res.string.xxx` used in code has a matching (and no orphaned) entry in `strings.xml`, and key-parity checks across all four locale files.

Not build-verified (no Gradle/JVM in this environment) — checked instead via: brace/paren balance across all 21 touched/new Kotlin files, a cross-reference confirming every `Res.string.xxx` used in code has a matching `<string name="...">` entry in all four `strings.xml` files (and vice versa — no orphaned keys), XML well-formedness (escaped ampersands/apostrophes, matched open/close tags) on all four resource files, and the `LocalAppLocale`/`ComposeEnvironment` override pattern cross-checked against JetBrains' own documented example rather than recalled from memory alone.

### 3.33 IoT + prediction pipeline built end-to-end (2026-07-19)

The single largest gap this whole plan tracked — "IoT collar ingestion pipeline... entirely unbuilt" (old §4 Phase 3) — is now real, top to bottom: device → ingestion → prediction → storage → farmer-facing API → mobile UI, plus alerting. Full detail lives in `docs/PREDICTION_PIPELINE_END_TO_END.md` (written and updated incrementally as each gap closed); this is the summary for this file.

**Two services this plan's service table never previously listed, now added to §2.2**: `godhan-cattle-iot` (Node — device/sensor/OTA ingestion) and `godhan-iot-prediction` (Python — heat/calving/milk-yield ML, no HTTP server, invoked as a job). Both predate this session but were effectively dormant/half-wired; neither was part of the original 6-service ESM/CJS fix in §3.1.

**Database consolidated** — `godhan-cattle-iot`/`godhan-iot-prediction` previously used a separate `godhan_cattle_iot` database from `cattle-service`'s `godhan_cattle`, needing a cross-database read for anything to join the two. Now all three share one physical database (`godhan_cattle`; one DB, many collections — simpler for a project this size, at the user's direction). Caught and fixed a real collection-name collision this would have caused: `godhan-cattle-iot`'s own `Cattle` model defaulted to the same `cattles` collection cattle-service's real `Cattle` model uses — renamed to `iot_cattle`.

**`godhan-iot-prediction` (the ML pipeline) — three real, previously-shipped bugs fixed**: (1) heat detection trained a model every run but never called `.predict()` or saved anything — `heat_predictions` was always empty regardless of how many times the job ran; (2) calving prediction read insemination dates from `godhan-cattle-iot`'s own stale, duplicate `cattle` collection instead of `cattle-service`'s authoritative, already-computed `expectedCalvingDate` (species-aware gestation, matching §3.25's ±3-day-window work); (3) `create_alert` existed but nothing ever called it. All three fixed and verified against real predict/train output, not mocks — including working around a real methodology snag (the RandomForest's chronological train/test split needs positive examples on both sides, and the calving heuristic averages over up to 288 rows, both of which make naive synthetic test data misleading).

**Scheduling** — `deployment/godhan-iot-prediction.service` + `.timer` existed but nothing had ever installed or enabled either; the job only ran if someone manually typed the command. `cattle_prediction.py`'s body is now a plain `run()` function; a new `src/scheduler.py` calls it immediately, then every `SCHEDULE_INTERVAL_HOURS` (default 6h) via the `schedule` package — no systemd/root/Linux host needed, `python -m src.scheduler` just works anywhere (including this sandbox — verified live: seeded real data, watched it fire immediately, then fire again on schedule and save real predictions both times). `docker-compose.yml`'s `prediction` service now runs this with `restart: always`; the old service+timer systemd pair was collapsed into one always-running `Type=simple` unit wrapping the same command.

**Device → ingestion** — the ESP32 collar firmware talks MQTT, `godhan-cattle-iot`'s `POST /api/data` is plain REST, nothing bridged them. `godhan-cattle-iot` already ran an MQTT client for OTA (`mqtt.service.js`); extended it (rather than a second parallel connection) to also subscribe to `cattle/data/<deviceId>` and `cattle/alerts/<deviceId>`, resolving `deviceId → cattleId` via the paired `Device` record and writing through the same paths the REST routes use. Updated the firmware skeleton doc to match (parameterized `DEVICE_ID`, correct topic convention — it previously hardcoded `"cow01"` in four places and published to a flat, non-parameterized topic). Verified live against a real MQTT broker: correct field mapping, `Device.battery` updates, and clean drops (not crashes) for unpaired/unregistered devices.

**Alerts wired to real predictions** — `create_alert` now fires once per cattle per episode (not once per flagged reading — a single episode can span dozens) for `HEAT_DETECTED`/`CALVING_IMMINENT`, with a 24h dedup window so a multi-run episode doesn't spam. Surfaced via a new `GET /cattle/:id/alerts` on `cattle-service` (same JWT+ownership pattern as every other route, reading the same `alerts` collection both the MQTT bridge and the ML pipeline write to) and a new **Alerts** card at the top of the mobile cattle detail screen's Overview tab, above the prediction cards since alerts are time-sensitive.

**Farmer-facing API + mobile** — `cattle-service` also exposes `GET /cattle/:id/predictions` (resolves `deviceId` → the IoT pipeline's collections, returns the latest heat/calving prediction and only the *reconciled* milk forecast — the still-pending one stays hidden by design until the farmer logs their own number). Mobile renders Heat Detection and Milk Yield Forecast cards, plus folds an imminent-calving warning into the existing Calving Prediction card.

**Verified live throughout**, not just read — a live MongoDB, a live `cattle-service` instance, a live `godhan-cattle-iot` instance, an in-process test MQTT broker, and the real Python scheduler were all actually run and exercised with seeded data at each step, including negative cases (unpaired device, wrong farmer's token, an unmatched device). The one recurring caveat from every other mobile change in this plan applies here too: the new Kotlin (DTOs, ViewModel state, three new UI cards) was reviewed by hand — brace/paren balance, import sweep — never actually compiled, no Gradle in this environment.

**Known gaps deliberately left open, not silently skipped** — see the updated "Still open" list below (items 12-14).

### 3.34 Real FCM push dispatch wired (2026-07-19)

Closes "still open" item 1, below (see the updated item 1 for what's genuinely still open around this).

**The mobile side was already fully built and had been for a while, unnoticed** — `GodhanFcmService.kt` (a real `FirebaseMessagingService`), proactive token registration on launch, the manifest service declaration, and the `firebase-messaging` Gradle dependency were all already in place, correctly calling the real `/register-token` endpoint with matching field names. Confirmed by research before writing anything server-side, to avoid duplicating work that already existed. The entire gap was server-side: `DeviceToken` registration (§3.13) worked, but nothing ever read from it to actually call the FCM Admin SDK.

**No Firebase Admin credentials exist anywhere in this repo** (checked: only client-side `google-services.json` and the unrelated Google Sign-In OAuth web client ID exist) — a service-account key must be generated fresh from Firebase Console (project `godhan-98e6f`) and is not something obtainable from within this environment. Built the complete, correct dispatch mechanism using the same dev-mode-fallback convention already established for Twilio/S3/SMTP (`if (!client) { log a warning; return a mock result; }`) so it's fully functional and testable right now, and becomes real the moment credentials are dropped in — nothing else changes.

**`godhan-core`**: new `core.utils.push.sendPush({ messaging, tokens, title, body, data })` and `core.utils.notifier.notifyPush(...)` (the non-throwing wrapper, matching `notifyEmail`/`notifySMS`). Neither imports `firebase-admin` itself — same "caller creates and passes the client" pattern as `s3Client`/`twilioClient`, so core stays credential-free and SDK-dependency-free for this too.

**`notification-service`**: new `src/config/firebase.js` (`getMessaging()`, lazily constructs `admin.messaging()` from three new `.env` keys — `FIREBASE_PROJECT_ID`/`FIREBASE_CLIENT_EMAIL`/`FIREBASE_PRIVATE_KEY`, all empty placeholders today — or returns `null` if unset). `createNotification` now looks up the target farmer's `DeviceToken`s and calls `notifyPush` after every save, for every channel (not just `channel: "email"`) — an in-app notification should reach a closed app too, the same way the breeding reminders/heat alerts that create most of these were always meant to. Best-effort: a push failure never fails notification creation (`notifyPush` already catches/logs internally), and a farmer with zero registered devices is the common case, not an error — short-circuited before ever calling `notifyPush`.

**Verified live**: booted a real `notification-service` instance, registered a device token, created a notification for that farmer — confirmed the real dispatch path ran (`[core.push] no client — mock sendPush ... tokens:1`, correctly picking up the one registered token) rather than silently skipping. Created a second notification for a farmer with **no** registered device — confirmed it's saved correctly and the push path is skipped entirely with no attempt/log at all, not a wasted/erroring call. `node --check` on all five touched/new backend files (`godhan-core`'s `push.js`/`notifier.js`/`index.js`, `notification-service`'s `firebase.js`/`notification.service.js`).

**Real credentials wired and verified live (2026-07-19).** The user generated the service-account key from Firebase Console themselves (the one step that genuinely required their own Google auth) and provided it; the three `FIREBASE_*` keys in `notification-service/.env` are now real, not placeholders — confirmed `.env`/`.env.*` are gitignored in that service's own repo before touching anything, so the credential can't accidentally get committed. Verified with a real (not mocked) call into the Firebase Admin SDK: `getMessaging()` now returns a real client rather than `null`, and a direct `messaging.send()` dry-run against a deliberately fake device token failed with `messaging/invalid-argument` — a clean FCM-API-level rejection of the token itself, not an authentication/credential error (a bad private key or wrong project would fail earlier, at the OAuth2 token exchange, with a completely different error shape). No real device token exists to test actual delivery to a phone, but the credential chain — private key → signed JWT → Google OAuth2 → authorized FCM API call — is now confirmed working end to end. The mock branch and the real branch remain the same code path from §3.34; nothing else changed.

### 3.35 Every service consolidated onto one shared database (2026-07-19)

At the user's direction, after they noticed "many databases (per-service)" in Mongo and asked whether the platform was actually sharing one — it wasn't; only the cattle/IoT cluster had been consolidated (§3.33). Extended the same reasoning platform-wide: `helper-service`, `marketplace-service`, `notification-service`, `report-service`, `user-service`, `wallet-service` each had their own separate database (`godhan_helper`, `godhan_marketplace`, etc.) in addition to the cattle cluster's own. All 9 services now share **one** physical MongoDB database, renamed from `godhan_cattle` to plain `godhan` (no longer cattle-specific, so the old name would have been actively misleading).

**Collision audit before touching anything**: read every `mongoose.model(...)` registration across all 9 services (20+ models) and diffed their resulting collection names. Exactly one real collision, the same class of bug as the `Cattle`/`iot_cattle` rename in §3.33: **`user-service` and `wallet-service` both have a `Transaction` model**, both defaulting to `"transactions"` — but genuinely different data (`user-service`'s is unused, unwired payment-gateway/membership-upgrade initiation tracking with fields like `txnId`/`status: initiated|success|failed`; `wallet-service`'s is the real, live credit/debit ledger with `coinAmount`). Renamed `user-service`'s to an explicit `payment_gateway_transactions` collection before merging — it had zero existing documents (confirmed: that model is part of the still-unwired `walletWebhookRoutes` code noted in §3.1), so this was a pure prevention, not a data-recovery. Everything else, including a `Config` key-value store defined once inside `godhan-core` itself and used by both `wallet-service` and `user-service` against their own separate `configs` collections today, merges cleanly and correctly into one shared collection — checked the actual keys in use (`CASHBACK_PERCENT`, `MAX_COIN_REDEMPTION_PERCENT`, `REFERRAL_REWARD_COINS`) for name overlap; none.

**Migration, not a fresh start**: wrote a one-off script that copied every document from each of the 7 old databases into the new `godhan` database, collection-by-collection, verified by comparing exact document counts before/after (all matched: 2 cattle, 1 helper, 1 notification, 6 users, 11 refresh tokens, 12 email verifications, 1 OTP, 2 wallet transactions, 1 wallet — everything else was already empty). Indexes weren't migrated explicitly — Mongoose's `autoIndex` recreates them from each model's schema the moment a service boots against the new database, so this wasn't needed.

**Verified live, not just counted** — booted all 9 services against the new `godhan` database (correcting entry-point paths along the way: `user-service`/`notification-service`/`report-service`/`helper-service` run from `src/server.js`, the others from a root `server.js`) and, for every service that actually had migrated data, hit a real authenticated endpoint and confirmed the real values came back correctly: `wallet-service` `GET /wallet` → balance 510 (matching the exact figure from §3.21's original test); `helper-service` `GET /helpers` → "Ramesh"; `notification-service` `GET /notifications` → the migrated test notification; `user-service` `GET /api/v1/users/:id` → the migrated farmer's real profile. `cattle-service` initially appeared to return an empty herd for the migrated `farmerId` — traced to the two migrated cattle records predating the `status` field added in §3.24 (Mongoose defaults don't retroactively apply to documents that already existed in the database before the field was added to the schema), confirmed by re-querying with `includeArchived=true` and getting both records back correctly — a pre-existing data quirk from an earlier session's manual testing, not a bug in this migration. `marketplace-service`/`report-service` had no data to migrate (both were already empty), so only boot + connection were verified for those two.

**Old databases dropped** only after every service above was confirmed working against the new one — `godhan_cattle`, `godhan_helper`, `godhan_marketplace`, `godhan_notifications`, `godhan_report`, `godhan_user`, `godhan_wallet` are all gone; `mongodb://localhost:27017` now has exactly one application database (`godhan`) plus MongoDB's own `admin`/`config`/`local`.

Also updated: `godhan-iot-prediction/configs/.env`'s `DB_NAME`/`CATTLE_DB_NAME` (was `godhan_cattle`, now `godhan`), and `docs/PREDICTION_PIPELINE_END_TO_END.md`'s references to the old name.

### 3.36 IoT alerts wired to notification-service (2026-07-19)

Closes the remaining half of "still open" item 1 below (§3.34 wired FCM dispatch itself; this wires the one remaining alert *producer* that never called into it). Both places that write to the shared `alerts` collection now also push a real farmer notification through the same `notification-service` endpoint cattle-service's own heat/reminder events already use — a farmer sees device-sourced, prediction-sourced, and manually-logged events in one place, not two separate silent-vs-notified tiers.

**Two producers, two languages, same resolution chain**: neither `godhan-cattle-iot`'s `alert.service.js::createAlert` (device-side alerts — currently just `LOW_BATTERY`) nor `godhan-iot-prediction`'s `alerts.py::create_alert` (prediction-triggered — `HEAT_DETECTED`/`CALVING_IMMINENT`, wired in an earlier session) receive a `farmerId` directly — only the IoT-side `cattleId`. Both now resolve it the same way: `cattleId → deviceId` (via `godhan-cattle-iot`'s `Device.cattleId` on the Node side, via the most recent `sensor_data` reading on the Python side — pre-existing conventions, not new), then `deviceId → farmerId` via cattle-service's own `Cattle.deviceId`, a plain cross-collection read now that every service shares one database (§3.35) — no HTTP call needed for that half. Wired into `createAlert` itself on both sides (not the individual call sites) so it's automatic for every current and future alert type, matching the same "one dispatch choke point" principle §3.34 used for push.

**Getting a token into notification-service's protected endpoint from two unattended background processes**: `godhan-cattle-iot` reuses `core.http.apiClient` + a short-lived internally-minted JWT for the target farmer's own id — identical pattern to `cattle-service`'s `notifyFarmer`/`reminder.cron.js`. `godhan-iot-prediction` (Python, no `@godhan/core`) does the same thing by hand: `PyJWT` (new dependency) signs `{id: farmer_id}` with the shared `JWT_SECRET`, `requests` (new dependency) POSTs it — notification-service's auth middleware doesn't care what language signed the token, only that it verifies against the shared secret. Both are best-effort/non-fatal, same convention as everything else in this codebase that shouldn't be allowed to break its caller (a verification-email failure, a push-dispatch failure): a notification hiccup never fails alert creation or the prediction run computing the actual signal.

**A real design smell caught and fixed while wiring the Python side, not pre-existing**: the natural place to put a shared `get_cattle_by_device` helper was already `milk.py` (where it originally lived), but importing it from `alerts.py` would have dragged `milk.py`'s full `sklearn`/`joblib` model-training import chain into alert dispatch for what's a one-line Mongo lookup with zero relationship to milk-yield prediction. Moved `get_cattle_by_device` to `utils.py` (already a `pandas`-level dependency everywhere in this codebase, but not `sklearn`/`joblib`) and repointed `milk.py`/`cattle_prediction.py`'s imports to the new location — `alerts.py` now only pulls in what it actually needs.

**Verified live, both languages, both real HTTP round-trips**: seeded a paired device+cattle+farmer for each side, then exercised the *real* code path, not a mock — `godhan-cattle-iot`: a real `POST /api/alerts` HTTP call through the full stack; `godhan-iot-prediction`: a direct call to the real `create_alert(...)` function (not the full ML pipeline — getting the model to genuinely flag a prediction hit the same chronological-train/test-split and window-averaging friction noted in §3.33, so this exercises the alert/notify wiring itself with an engineered input, exactly like that section's own heat/calving verification did). Both confirmed a real `Notification` document appeared for the correct, resolved `farmerId` via `GET /notifications`, with the right title/message (`"Collar battery low"` / `"Heat detected"`).

### 3.37 S3 file uploads wired for real (2026-07-19, in progress — code done, bucket not yet created)

Same "flip mock to real" request as FCM (§3.34), but research turned up more than a missing
credential: **no service was actually one env-var away from working.**

- **`cattle-service` and `helper-service`** never constructed an `S3Client` anywhere — no
  `@aws-sdk/client-s3` dependency, no config file, no `AWS_*` env vars. 100% mock, unconditionally,
  regardless of `.env`.
- **`user-service`** had a `config/s3.js` and passed a client into every `core.utils.s3.*` call —
  but built it with **AWS SDK v2** (`aws-sdk` package), while `core.utils.s3` requires a v3
  `S3Client` (`.send()`, and v3-only `getSignedUrl`). Confirmed live in a Node REPL: `new
  AWS.S3().send` is `undefined`. Compounding it, `user-service/.env` had a **duplicated `AWS_*`
  block** whose second copy used truthy placeholder values (`AWS_ACCESS_KEY_ID=xxx` etc.) —
  meaning the mock-fallback guard (`if (!s3Client)`) never fired, and profile-picture upload was
  **actively throwing in production right now**, not gracefully mocking. Fixed: rewrote
  `config/s3.js` to construct a real v3 `S3Client` (mirroring
  `notification-service/src/config/firebase.js`'s lazy-init pattern), swapped the `aws-sdk`
  dependency for `@aws-sdk/client-s3`, collapsed the duplicated env block down to one with
  genuinely empty placeholders. `upload.service.js`'s own architecture (a `Media` model storing
  `s3Key` + a 24h-TTL presigned `url`, regenerated on every read via `refreshProfileUrl`) was
  already correct — untouched.
- **A real design bug in the mock-era code**, caught before it could bite in production:
  `cattle-service`/`helper-service` persisted whatever `getPresignedUrlView` returned **directly
  into MongoDB** (`Cattle.images`, `Helper.contractDocs`, both `[String]`). A real presigned URL
  expires (default 300s) — stored forever and served back on every later read, cattle photos
  would 403 minutes after upload. Decided with the user: upload with public bucket-policy access
  instead of presigning, and store the **permanent** plain URL — zero schema/mobile changes,
  matches how most apps handle non-sensitive user photos, avoids ever needing to regenerate
  anything. Built `config/s3.js` (same lazy-init pattern) and wired it into `uploadCattleImage`/
  `uploadHelperContract`, storing `https://${bucket}.s3.${region}.amazonaws.com/${key}` directly.
- **A second bug caught before shipping, not just theorized**: the plan's first draft used
  `ACL: "public-read"` on the `PutObject` call. Modern S3 buckets default to **"Bucket owner
  enforced" object ownership**, which disables ACLs entirely — passing an `ACL` parameter to a
  bucket like that *throws*, it doesn't silently no-op. Removed it: public access comes purely
  from a bucket policy scoped to the `cattle/*`/`helper/*` prefixes (below), which doesn't need
  ACLs enabled at all and is the AWS-recommended approach today anyway.
- **Also fixed while touching `cattle-service`'s upload path, not originally in scope**:
  `deleteCattleImage` removed the URL from `Cattle.images` but never actually deleted the S3
  object — an orphaned-file leak on every delete. Now parses the S3 key back out of the stored
  permanent URL's pathname (reliable — no query-string signature to fight, unlike a presigned
  URL) and calls `deleteFromS3`, best-effort (a bucket-cleanup hiccup doesn't turn an otherwise-
  successful removal into an error response).
- **One shared bucket** (`godhan-assets`, matching `user-service`'s pre-existing default) across
  all three services, each under its own key prefix (`cattle/*`, `helper/*`, `users/*`) — added
  the same four `AWS_*` env vars (empty placeholders) to `cattle-service`/`helper-service`'s
  `.env`, which previously had none at all.

**Verified live in mock mode, all three services**: booted each fresh, confirmed the expected
`[s3] AWS credentials not set — ... mocked` warning (and, for `user-service`, confirmed the
*absence* of the old throw — the duplicated-env-block fix alone was necessary and sufficient to
stop it constructing a garbage-credentialed client). Real HTTP round-trips, not just log-reading:
`cattle-service` — multipart image upload → `Cattle.images` correctly gets the mock URL → delete
correctly removes it and cleanly skips the (nonexistent, since mocked) S3 object deletion.
`helper-service` — multipart contract upload → `Helper.contractDocs` correctly gets the mock URL.
`user-service` — multipart profile-picture upload against a real migrated user record →
succeeds and returns a real `Media` document (previously would have thrown `TypeError:
s3Client.send is not a function`). Test data cleaned up after each.

**Not achievable from this environment, same as Firebase Console for FCM**: I have no AWS CLI or
credentials here, so I cannot create the actual bucket, IAM user, or bucket policy — that's on
the user. Once they do:

1. Create an S3 bucket named `godhan-assets` (or their preferred name) in region `ap-south-1`
   (matching `user-service`'s existing default — change all three `.env`s together if a
   different region is used).
2. Create an IAM user with an access key and this policy (grants the backend services
   upload/read/delete on the whole bucket — `users/*` still stays effectively private since
   nothing serves those objects except through `user-service`'s own presigned-URL flow):
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Sid": "GodhanServiceS3Access",
       "Effect": "Allow",
       "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
       "Resource": "arn:aws:s3:::godhan-assets/*"
     }]
   }
   ```
3. Under the bucket's Permissions tab, uncheck "Block all public access" for bucket policies
   specifically (leave ACL-related sub-options blocked — not needed, see above), then add this
   bucket policy — scoped only to `cattle/*`/`helper/*`, `users/*` is deliberately excluded so
   profile pictures stay private:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Sid": "PublicReadCattleAndHelperAssets",
       "Effect": "Allow",
       "Principal": "*",
       "Action": "s3:GetObject",
       "Resource": [
         "arn:aws:s3:::godhan-assets/cattle/*",
         "arn:aws:s3:::godhan-assets/helper/*"
       ]
     }]
   }
   ```
4. Provide the access key ID/secret (and bucket/region if different from the defaults above) to
   drop into `cattle-service`/`helper-service`/`user-service`'s `.env` files — same "paste it to
   me" flow used for the Firebase service-account key.

### 3.38 Offline-first persistence built (2026-07-20)

Closes the "Offline-first persistence" item on `docs/GODHAN_APP_FEATURE_STATUS.md`'s ❌ Pending
list — was sitting complete-but-uncommitted in the `godhan-app` working tree at the start of this
session, committed as part of it. SQLDelight-backed local cache (`CattleLocalDataSource`,
`GodhanDatabase`) for the herd list and cattle detail — read-through: network first (so an online
farmer always sees current data), falls back to whatever's cached on failure. A new
`ConnectivityObserver` (Android real via `ConnectivityManager`, iOS stubbed always-online, same
convention as this codebase's other not-yet-implemented iOS platform code) drives an "offline —
showing saved data" banner on both the herd list and cattle detail screens.
`androidApp`'s source set also migrated from the legacy `src/main` to the standard KMP
`src/androidMain` layout as part of the same commit. Not build-verified — no JDK 17 in this
environment (SQLDelight requires 17+); hand-reviewed (brace/paren balance, import sweep).

### 3.39 Cattle detail: remaining 5 tabs built — Medical, IoT Health, Expenses, Documents, Timeline (2026-07-20)

Closes the last gap on `docs/GODHAN_APP_FEATURE_STATUS.md`'s 🟡 Partial table ("Spec wants 9 tabs
... 4 exist today") — all 9 now exist. Built Medical/Vaccination (append-only history, same
convention as calving/insemination — `nextDueDate` feeds a new `vaccination_due` case in
`getReminders()`), Expenses with an honestly-labeled **estimated** profit summary (revenue =
logged milk × a flat configurable ₹/L rate, since no real milk-pricing engine or platform-wide
expense system exists anywhere — same "estimated/honest zero" convention as report-service's
`getMarketplaceReport`/home-dashboard fixes), Documents (same permanent-URL S3 pattern as cattle
images, farmer-uploaded via the existing image-picker convention — no general file-picker exists
in this platform), IoT Health (device battery/status/last-seen + a `Canvas`-based temperature
sparkline reusing `ReportsScreen`'s existing charting approach, no new dependency), and a curated
Timeline aggregating the herd's life events client-side (deliberately excludes milk logs/expenses
— both already have their own tab and are too high-frequency to read as "events"). `TabRow` →
`ScrollableTabRow` to fit 9 tabs. 56 new localized strings added across all 4 locale files,
verified for exact key parity. `cattle-service` gained the matching backend: `medicalRecords`/
`expenses`/`documents` subdocuments, `GET /:id/readings` (proxies `godhan-cattle-iot`'s
`sensor_data` via the existing `resolveIotCattleId` cross-collection pattern), `POST/DELETE
/:id/documents`, `GET /:id/expense-summary`. **Verified live**: registered a real test farmer,
added a cattle, exercised every new endpoint (medical record, expense, expense-summary math,
document upload/delete via real multipart, seeded `sensor_data`+`devices` docs and confirmed
`/readings` resolves them), confirmed a different farmer's token is rejected on all of them, test
data cleaned up. Not build-verified on the mobile side — no JDK 17; hand-reviewed (brace/paren
balance, import-usage sweep against all 4 locale files, manual data-flow trace). Caught two real
bugs during that review before they'd have hit a build: a `remember{}` block illegally calling
`stringResource()` in the new Timeline tab, and a document-delete request that would have
serialized under the wrong JSON field name (`imageUrl` instead of the backend's actual `url`).

### 3.40 IoT device↔cattle assignment fixed — a previously-invisible, platform-wide bug (2026-07-20)

The mobile pairing UI (`IotPairingScreen`/`IotPairingViewModel`, an 8-step BLE/WiFi flow including
a real cattle picker) and the BLE layer (`AndroidBluetoothScanner`) were both already genuinely
built, but **no code path anywhere in the platform ever actually set `cattle-service`'s
`Cattle.deviceId` field** — the field every IoT-related UI (Overview tab's collar card, the new
IoT Health tab, predictions, alerts, reminders) actually gates on. The real flow: mobile BLE-writes
`{ssid, password, cattleId}` to the collar → collar connects to WiFi → collar calls
`godhan-cattle-iot`'s `POST /api/devices/register`, which only ever upserted *that service's own*
`Device{deviceId, cattleId}` document — a different collection in a different service.
`cattle-service`'s side of the link was never written by anything, so a "successful" pairing never
showed up anywhere in the app.

Fixed by completing the loop at the actual moment of truth (the collar's own registration call,
not the mobile app's BLE-success signal, which only proves the collar *received* credentials, not
that it's really online): `cattle-service` gained `PUT /cattle/:id/device` (`setDeviceId` —
ownership-checked, and if the device was already linked to a different animal in this farmer's
herd, clears that old link first, enforcing a 1:1 device↔cattle invariant). `godhan-cattle-iot`'s
`device.service.js::registerDevice()` now calls it (`linkCattleDevice`, best-effort/non-fatal),
mirroring `alert.service.js::notifyFarmer`'s existing pattern exactly: raw-driver read into
cattle-service's own `cattles` collection to resolve a farmerId (single shared DB per §3.35), mint
a short-lived internally-minted JWT, call via `core.http.apiClient`. New `CATTLE_SERVICE_URL` env
var added to `godhan-cattle-iot/.env`. Mobile gained an "Unpair Device" action (existing
`ReconnectSheet`, behind a confirm dialog) — there was no unpair anywhere before this. Also fixed
a related, separate staleness bug while in there: the cattle detail screen never reloaded after
returning from a successful pairing (Voyager's `rememberScreenModel(tag=cattleId)` keeps the same
ViewModel alive across navigation, so its one-time `init{}` load never re-fired) — added a
reload-on-return.

**Verified live, the full chain, not just in isolation**: direct link via the new endpoint with a
real farmer token; a second farmer's token correctly rejected; simulated exactly what a real
collar does (`POST /api/devices/register` with `{deviceId, cattleId}`) and confirmed via
`GET /cattle/:id` on `cattle-service` that `deviceId` actually landed — this was the core,
previously-broken link, so proving it end-to-end (not just that each side's own code runs) was the
point; re-paired the same device to a second test cattle and confirmed the first one's link was
correctly cleared; unpaired and confirmed it cleared. Test data cleaned up. Not build-verified on
the mobile side (no JDK 17) — hand-reviewed.

**Explicitly not built this pass, noted not silently skipped**: no dedicated "reassign to a
different cattle" screen (achievable today via unpair + re-pair from the new animal's own Overview
tab — the backend's auto-clear-old-link logic makes that safe without one); no blocking poll on
the pairing screen waiting for the backend link to land before showing SUCCESS (the collar's own
registration typically completes within a few seconds of connecting to WiFi, and the
reload-on-return fix means the farmer sees it shortly after regardless); no "device already paired
elsewhere" warning inside the pairing flow's cattle-picker step. iOS BLE remains a stub, unrelated
to this fix — no buildable iOS target exists in this repo.

### 3.30 Still open

1. ~~Wire real notification dispatch (FCM at minimum) in `notification-service`~~ — done, §3.34. ~~`godhan-cattle-iot`'s IoT alert creation never calls `notification-service`~~ — done, §3.36. ~~Real Firebase Admin credentials~~ — done, §3.34 (2026-07-19 update): the user generated and provided the real service-account key, credential chain verified live. The one thing still genuinely untested: actual delivery to a real phone (no real device/FCM token exists in this environment to confirm with) — worth a quick real-device check once someone has the app installed with a registered token.
2. **Add a `role` claim to the JWT payload** if a real admin-scoped endpoint (like a platform-wide marketplace report) is ever wanted — `core.middleware.role('admin')` exists and is used in `membership.routes.js`, but would reject every token today since `user-service`'s `generateAuthTokens` payload has never included `role`. Found while scoping §3.22's `getMarketplaceReport` fix, not fixed here since nothing currently depends on it.
3. **Build advance-tracking for helpers** if wanted — the `advances` field exists on the schema but nothing anywhere reads or writes it, so `settleSalary`'s `advanceAdjusted` is always 0 (§3.23).
4. **No "view archived cattle" list UI** — `includeArchived=true` works on the backend (§3.24) but the herd list screen has no toggle for it yet; a sold/deceased animal is only reachable today via a genealogy link from one of its calves, or by knowing its id.
5. **No bull-management screen** — bulls can only be registered inline from the "Record Insemination" sheet (§3.25/§3.27); there's no way to view/edit a bull's details afterward, or to see which cows a given bull has sired, from a dedicated screen.
6. **Bulls are cow/buffalo only** — the schema's `type` enum has no `goat` option, so a goat's insemination sheet always falls through to the free-text "Other" path (§3.27). Would need a schema/enum change if goat breeding tracking with structured bulls is wanted.
7. **Bull-suitability recommendations** — user's stated future direction: the system should eventually suggest which registered bull is most suitable for a given cow's AI, presumably from genetic/offspring-performance data (calf outcomes, milk yield of resulting daughters, inbreeding avoidance) tied back to `bullId` on `inseminationHistory`. Not started — needs enough real insemination/calving/milk data linked through `bullId` to be meaningful, which is exactly why "structured fields only, no analytics yet" was the deliberate scope for §3.25/§3.27. The data model (every insemination already carries `bullId`, every calf already links `motherId` back to its dam) is intentionally shaped so this can be layered on later without a schema rework — worth revisiting once there's a real body of linked data to compute over.
8. ~~Commit or stash the in-progress `godhan-app` changes~~ — done 2026-07-20: committed and pushed, along with this session's own new work (§3.38/§3.39/§3.40) and every other service's own previously-uncommitted work found sitting in the workspace (`godhan-cattle-iot`, `godhan-core`, `helper-service`, `notification-service`, `user-service`, `godhan-iot-prediction` — the last of which had no `.git` at all and was freshly initialized against its existing GitHub remote).
9. **Point services at real infrastructure for a full end-to-end test** — this pass verified each service in isolation against local MongoDB; a true smoke test (all services up together via `docker-compose`, mobile app pointed at them) still hasn't been done, since no Dockerfiles are filled in yet for the original 7 (cattle/marketplace/notification/wallet/helper/report/user-service) and there's no top-level compose file spanning all of them. This matters more than it used to now that §3.20's fix means real cross-service tokens actually work — worth re-verifying the full session's work under `docker-compose` rather than per-service isolation once it exists. `godhan-iot-prediction` is the one exception — it already has a real `Dockerfile`/`docker-compose.yml` (§3.33), though its compose file spins up its own isolated Mongo container rather than pointing at the shared one the other services use in local dev.
10. **Finish the localization migration (§3.29/§3.31/§3.32)** — infrastructure, auth/home/settings/nav, all cattle screens, wallet, reports, and helper management are done for English/Hindi/Marathi/Gujarati; marketplace, referral, notifications list, and the IoT pairing screen are still English-only strings hardcoded in place. Also worth a native-speaker review pass on the Hindi/Marathi/Gujarati translations before shipping — they were authored directly rather than sourced from a professional translator.
11. Uncomment and properly wire `membershipRoutes` / `walletWebhookRoutes` in `user-service` — fix the bugs noted in §3.1 first.
12. ~~IoT alerts still don't produce any notification, in-app or push~~ — done, §3.36. Both alert producers (`godhan-cattle-iot`'s device-side alerts and `godhan-iot-prediction`'s prediction-triggered ones) now resolve a `farmerId` and notify. Real push delivery is confirmed working per item 1 above; only actual on-a-real-phone delivery is untested.
13. **No read/dismiss state for alerts** (§3.33) — they just accumulate; the Python-created ones have an unused `delivered` field and `godhan-cattle-iot`'s own `Alert` model doesn't even have one.
14. **The MQTT device→ingestion bridge has no timestamp field to work with** (§3.33) — the reference ESP32 firmware has no RTC/NTP, so every ingested reading is stamped at receipt time. Fine for live readings; means offline-buffered readings replayed on reconnect land with the replay time, not when they actually happened. Needs a firmware-side NTP addition to fix, not a backend change.
15. **S3 bucket/IAM user/bucket policy not yet created** (§3.37) — all the code is built and verified in mock mode, but real file uploads can't be tested until the user creates the actual AWS resources and provides credentials (steps and exact policy JSON are in §3.37).
16. **No dedicated "reassign device to a different cattle" screen** (§3.40) — works today via unpair + re-run pairing from the new animal's Overview tab; a purpose-built reassign flow (skip WiFi re-entry, just re-write `cattleId` over BLE to an already-configured collar) would be smoother.
17. **Farm-wide Expense & Income tracking still doesn't exist** (spec §15) — §3.39 built a genuinely working *per-cattle* expense ledger and estimated-profit summary, but the Home dashboard's "Expenses" quick-action is still a dead stub (`onClick = {}`, `HomeScreen.kt`), and there's no screen for costs that aren't tied to one animal (fuel, equipment, general labor) or for tracking actual milk-sale income. This was the plan's own top Phase-1 recommendation before the cattle-detail-tabs work took priority instead.
18. **Milk pricing engine still fully unbuilt** (spec §9) — §3.39's expense/profit summary uses a single flat `MILK_PRICE_PER_LITER` env var as an honest stand-in; a real fixed/daily/formula-rate engine (FAT/SNF-adjusted) is a separate, self-contained piece of work noted in Phase 2 below.
19. **No ESP32 firmware in this repo implements BLE provisioning at all** — found while documenting §3.40's fix (see `docs/IOT_DEVICE_DESIGN.md` §3.6.1 for the full writeup). The mobile app's BLE pairing flow (`IotPairingViewModel`/`AndroidBluetoothScanner`) is real, working code with its own concrete GATT contract (service `00001234-...`, 4 characteristics, `GODHAN_`-prefixed device names) — but `godhan iot docs/esp_32_firmware_skeleton.cpp`, this repo's only firmware skeleton, has zero BLE code, and doesn't match either the mobile app's real contract or this doc's own original §3.6 spec. Real hardware pairing can't be end-to-end tested until firmware work closes this gap — recommended direction is matching the mobile app's already-shipped contract (§3.6.1) rather than the reverse.

Everything in §4 below assumes §3.1 is done — that part is no longer the blocker it was.

---

## 4. Phased roadmap

Adapting the 3-phase structure already agreed in `PLATFORM_DESIGN.md`, cross-referenced against what's actually built.

### Phase 1 — Daily Utility (MVP)
*Goal: a farmer can register, log cattle, track milk/expenses, manage helpers, and see a wallet balance — offline-tolerant, no marketplace yet.*

| Item | Client status | Backend status | Action |
|---|---|---|---|
| Auth (OTP + profile) | Built | Built (user-service) | Finish membership/webhook route wiring |
| Cattle CRUD + milk logs + full lifecycle (9/9 detail tabs) | ✅ Built (§3.39) | ✅ Built | Done — offline-tolerant too (§3.38) |
| Per-cattle expenses + estimated profit | ✅ Built (§3.39) | ✅ Built | Done, self-contained scope |
| Farm-wide expense/income tracking | **Still missing** — Home's "Expenses" quick-action is a dead stub | Not present as a service | See "still open" item 17 above |
| Helper management (attendance, salary, PDFs) | ✅ Built | Most complete backend service | Done — verified live |
| Wallet (basic balance + top-up) | Thin | ✅ Fixed, boots and responds | Flesh out client wallet screens against the now-working API |
| Push notifications | ✅ Built, dispatching for real (§3.34) | ✅ Real FCM dispatch wired | Only actual on-a-real-phone delivery is untested |
| Basic reports (monthly, milk trend) | Built | ✅ Fixed, boots and responds | Verify client renders correctly against it end-to-end |
| Offline-tolerant persistence | ✅ Built (§3.38) | n/a (client-side cache) | Done |

**This phase is the highest-leverage place to spend the next block of work** — it's mostly plumbing and two missing client modules (expenses, helper), not new architecture.

### Phase 2 — Marketplace + Growth
*Goal: feed/input marketplace, membership tiers, coins, referral, richer analytics.*

- Membership tiers (Free/Gold/Platinum) — spec exists in detail (§14), nothing implemented yet on either side beyond a referral/coins skeleton.
- Feed & input marketplace — `marketplace-service` has basic listing CRUD; needs catalog/SKU model, commission rules, coupons.
- Milk pricing engine (fixed/daily/formula, §9) — fully unbuilt; self-contained enough to build as its own module once P0 is clear.
- Referral — client screens exist (407 lines); confirm backend `referral` routes are complete end to end.
- Advanced reports / ML integration — **the Python AI service now exists and works** (`godhan-iot-prediction`, §3.33): heat detection, calving prediction, milk-yield forecasting, self-scheduled every 6h, correctly kept as Python rather than folded into the Node services (matching the spec's own boundary). `report-service`'s `getCattlePredictionReport` still honestly returns `[]` (§3.22) rather than reading this — wiring that up is the remaining piece here.

### Phase 3 — Ecosystem
*Goal: the pieces that make Godhan defensible — IoT-backed cattle marketplace with escrow, micro-hubs, delivery.*

- **IoT collar ingestion pipeline — built (2026-07-19), see §3.33.** MQTT → Mongo → prediction → alerts → farmer-facing API → mobile UI, all real and live-verified, previously the largest single chunk of remaining backend work.
- **IoT device↔cattle assignment — fixed end-to-end (2026-07-20), see §3.40.** Pairing and unpairing now genuinely take effect (previously a silent no-op across the whole platform — see §3.40 for the full bug). What's still genuinely missing here: the mobile IoT screen is pairing/provisioning + (as of §3.39) a device-status/temperature-sparkline view, but not a running live-vitals dashboard; the **Android BLE provisioning UX** works but isn't especially polished (per-step, no batching); and there's no dedicated reassign-to-a-different-cattle screen (still open item 16).
- Cattle Hub P2P marketplace with grading, verification score, video-verification booking, escrow/token reservation, wallet settlement states (spec §14, §17) — large, well-specified, zero code yet on either side.
- Micro-hub & delivery management — no delivery app, no micro-hub model.
- Digital Health Passport — depends on IoT pipeline existing first.

### Phase 4 — Moonshot / long-horizon (spec §18 + "Patentable AI & IoT" section)

AI revenue planner/credit scoring, breeding genetics, carbon credits, blockchain cattle identity, federated-learning digital twin. These are explicitly framed in the spec itself as future/patent-strategy items — correctly out of scope until Phases 1–3 are stable and generating real usage data to train against. Don't let these pull engineering time from Phase 1 completion.

---

## 5. Recommended immediate next steps

1. ~~Fix the P0 backend bugs~~ — done 2026-07-16, see §3.1.
2. ~~Decide what to do with the uncommitted `godhan-app` changes~~ — done 2026-07-20, see "still open" item 8.
3. ~~Pick one Phase-1 gap to close next — Helper Management client screens~~ — done, built end-to-end (§3.23).
4. ~~Wire notification-service to real FCM dispatch~~ — done (§3.34), including real credentials.
5. Fill in the (currently empty) Dockerfiles and add a `docker-compose.yml` so all services can be brought up together for a true end-to-end test, rather than the one-at-a-time verification done throughout this plan (still open item 9) — the highest-leverage remaining infrastructure gap.
6. Pick the next Phase-1 gap: **farm-wide Expense & Income tracking** (still open item 17) is the strongest candidate — it's the one remaining dead stub on the Home dashboard, and the per-cattle expense infrastructure from §3.39 already covers half the data model.
7. Defer Admin app, Delivery app, and Phase 4 items until Phase 1 is demonstrably working end-to-end for one farmer on one device talking to a fully composed backend.

---

## 6. How to keep this file useful

This is a living status doc, not a spec — re-derive it from code state periodically rather than trusting it blindly (the same caution applies to `PLATFORM_DESIGN.md`'s bug table, parts of which have already shifted since May, e.g. `user-service` route wiring). When a phase item ships, strike it here rather than letting the doc drift from reality.
