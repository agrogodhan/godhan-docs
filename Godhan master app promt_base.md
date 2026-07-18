You are an expert solution architect. Generate a production-grade, end-to-end livestock “Godhan” platform with:

- Android Farmer/Buyer App in Kotlin (Jetpack Compose, MVVM, Clean Architecture)
- Shared Kotlin Multiplatform (KMP) core modules for domain, models, use-cases, validators, analytics (Android now; iOS-ready later)
- Separate Delivery Android App in Kotlin for marketplace logistics
- Admin Web App in Angular (v16+) with Material UI
- Backend as Node.js + Express microservices (TypeScript) with MongoDB, Redis, S3-compatible storage, MQTT broker, and Firebase Cloud Messaging
- Integrated ESP32 IoT firmware for cattle vital monitoring with BLE provisioning, WiFi telemetry, OTA update support; LoRaWAN planned 

========================
1) SYSTEM VISION & ROLES
========================
Purpose: End-to-end herd management, AI insights, IoT telemetry, commerce, labor/payroll, and advanced milk pricing—offline-first UX with predictive health alerts.

User Roles:
- Farmer: herd mgmt, milk/health tracking, helper management + payroll, device pairing, sell cattle, buy feed, wallet
- Buyer: browse/bid/buy cattle, order feed, track deliveries
- Institutional Buyer: contracts, recurring orders, SLAs
- Delivery Agent (separate app): pickup/drop, route, proof-of-delivery
- Admin (Angular): approvals, commissions, catalog, payouts, devices, firmware, payroll reports, audits,rought management, microhub management, delivery management

Access & Security:
- JWT auth + refresh tokens, RBAC/ABAC
- Subscription-tier gating (Free/Pro/Enterprise)
- Device auth via per-device key + signed MQTT/HTTPS tokens

================================
2) FEATURES — ANDROID MAIN APP
================================
Auth & Subscription:
- phone OTP + Google Sign-In
- Referral code optional; both get coins if used
- Subscriptions management
- Feature flags by tier (listing caps, AI tools, device connections, helper limits)

Herd Management:
- Cattle CRUD (species, breed, age, weight, price, milk yield, tags)
- Vaccination/deworming schedules + reminders
- Daily milk records, analytics (Room offline)
- Expense logging (feed/medical/labour), P&L dashboard

Cattle Hub(cattle trading):
- Listing creation with photos/videos (S3-like storage)
- Smart pricing guidance
- Fixed price + auction/bidding
- In-app chat (basic) + WhatsApp deep link
- Payments (Razorpay/UPI placeholder) with escrow-like flow
- Commission deduction on completed orders
- KYC placeholders (PAN/Aadhaar)

Marketplace (Feed & Inputs Commerce):
- Feed catalog, bundles, recurring orders
- Commission margins per SKU; coupons/discounts

Wallet & Rewards:
- Wallet balance (cash) + coins
- Referral rewards, cashback, promo credits
- Payout request to bank/UPI (mock service)
- Dynamic wallet badge (green > ₹1000, yellow ₹500–₹1000, red < ₹500)

Helper (Labor) Management:
- Add Helper: name, mobile, Aadhaar (optional), joining date, role (Permanent/Seasonal/Milker/Cleaner/Loader), wage type (daily/monthly), base salary/wage, bank/UPI (optional), preferred language (EN/HI)
- Fast Attendance: Full Day / Half Day / Absent / Overtime; batch mark multiple helpers quickly
- Salary Calc: auto calculation from attendance + overtime + leaves; carry-forward balances
- Advances & Ledger: record advances; auto-adjust at month-end; color-coded balance status
- Payslip PDFs: bilingual (EN+HI), with attendance summary, advances adjusted, net payable, employer signature/stamp; share/export
- Experience Certificate PDFs: tenure, role, remarks, QR verification placeholder
- History & Analytics: month-wise labor costs, attendance heatmap
- Subscription gates: Free (up to 2 helpers, no PDFs), Pro (unlimited + payslips + certificates)

Advanced Milk Pricing (see section 11 for details):
- Breed-wise fixed rates with validity periods
- Daily rate override
- FAT/SNF formula-based pricing with custom formulas
- Future-ready AI prediction for rate suggestions

UX & Intl:
- Compose, dark mode, EN/HI localization, accessibility
- Error/empty/loading skeleton states

Offline-first:
- Room + WorkManager for background sync (last-write-wins with server ts)

Notifications:
- FCM for bids, chat, delivery, device alerts, subscription, payroll, pricing reminders

==================================
3) FEATURES — DELIVERY ANDROID APP
==================================
- Login for Delivery Agent
- Assigned orders list, routing (Maps intents permitted)
- Pickup → transit → drop workflow; QR/barcode scan
- Proof-of-delivery (photos, notes, e-sign)
- Status updates via HTTP/WebSocket
- Offline queue with sync

===============================
4) FEATURES — ADMIN ANGULAR APP
===============================
- Login + role guard, interceptors
- Dashboard: GMV, commissions, listings, MAU, device status, labor costs
- Approvals: listings, KYC, payouts
- Catalog mgmt: feed SKUs, pricing, inventory, tax
- Commission rules (global/sku/breed)
- Subscriptions: plans, coupons, usage caps
- IoT: devices inventory, firmware library, OTA rollout
- Helpers & Payroll: helper directory, attendance overview, payroll exports (CSV/PDF)
- Milk Pricing: rate tables, formula templates, period validity, bulk updates
- Dispute center; reports export (CSV), audit logs
- Feature flags, content (FAQ/ToS)
- microhub management

====================================
5) ARCHITECTURE & TECH REQUIREMENTS
====================================
Android Apps (Main + Delivery):
- Kotlin, Jetpack Compose, MVVM + Clean Architecture
- Modules: :app, :feature-auth, :feature-herd, :feature-market, :feature-wallet, :feature-feed, :feature-chat, :feature-subscription, :feature-device, :feature-ai, :feature-helper, :feature-milk-rate, :core-ui, :core-network, :core-db, :core-analytics
- KMP Shared: :shared-domain, :shared-models, :shared-usecases, :shared-utils (expect/actual for platform)
- DI: Hilt; Coroutines + Flow; Retrofit or Ktor client; Kotlin Serialization
- Room for persistence; DataStore for prefs
- Tests: unit (JUnit), UI (Compose)

Backend (Node.js + Express, TypeScript):
Microservices:
- auth-service (users, roles, sessions, subscriptions, referrals)
- herd-service (cattle, health, milk, expenses)
- marketplace-service (listings, bids, orders, chat-lite)
- wallet-service (balances, coins, payouts, referrals)
- catalog-service (feed SKUs, pricing, inventory)
- payment-service (Razorpay integration, webhooks)
- delivery-service (tasks, status, POD artifacts)
- ai-service (health/feed/price suggestions; rules + ML hooks)
- iot-telemetry-service (MQTT/HTTP ingest, timeseries, device mgmt, shadow, OTA)
- labor-service (helpers, attendance, advances, payroll, documents)
- milk-rate-service (breed rates, daily rates, formula definitions, pricing API)
Infra/Common:
- MongoDB (incl. TimeSeries) & Mongoose; Redis (cache/queues)
- S3-compatible storage, MQTT broker (EMQX/Mosquitto), Socket.IO
- Swagger/OpenAPI per service; Zod/JOI validation
- Central auth via JWKS/shared secret; rate limits; CORS; optional mTLS
- Logging: Winston + morgan; tracing hooks
- Seeds & migrations (mongosh)

Security & Compliance:
- OWASP, input sanitization, least privilege
- Secrets via env; rotation; minimal PII
- Data export/delete endpoints; audit logs

DevOps:
- Dockerfiles per service; docker-compose for local
- CI (GitHub Actions): lint, test, build, image publish
- .env.sample per service; Postman collection
- README with one-command local up

=================================
6) MONETIZATION & BUSINESS RULES
=================================
Subscriptions:
- Tiers: Free, Pro, Enterprise
- Feature gates: max cattle count, AI tools, listing count, device connections, helper limits/PDFs, pricing features
- Server validates Play Billing tokens; prorations & grace
Commission:
- % commission on successful cattle sales + feed orders
- Configurable by breed/sku/category
Wallet/Coins:
- Earn via referrals, promos; spend on fees/discounts
- Payouts require basic KYC (mocked)
Disputes/Refunds:
- Basic dispute → admin resolution with refund/credit rules

===========================
7) IOT INTEGRATION (ESP32)
===========================
Hardware:
- ESP32-based wearable tag
- Sensors: DS18B20 (temp), MAX30102 (heart rate/SpO2), MPU6050 (activity), optional GPS
- Power: deep sleep, duty cycles; battery voltage monitor
- Phase 2: LoRaWAN-ready (SX1276/78) — abstract comms layer

Firmware (Arduino/C++):
- Modes: Pairing (BLE), Normal (WiFi/MQTT), OTA
- BLE provisioning: receive WiFi SSID/PWD + tenantId + cattleId + signed device bootstrap token
- Secure storage (NVS) for credentials & device keys
- Telemetry cadence configurable (e.g., 5–15 min), alert-burst on anomaly
- MQTT primary, HTTPS fallback
- OTA: HTTP(S) pull; signed firmware (SHA256 + version check)
- Local rules: if temp > X or HR outside band, send immediate alert; motion inactivity window

MQTT Topics (prefix `godhan/`):
- `devices/{deviceId}/telemetry` → JSON
- `devices/{deviceId}/alerts`
- `devices/{deviceId}/shadow/get|update`
- `devices/{deviceId}/ota/check|cmd`
- Retained birth message on connect with fwVersion, battery, rssi

Telemetry JSON Schema (example):
{
  "deviceId": "ESP32-ABC123",
  "cattleId": "CATTLE-001",
  "ts": 1739900000000,
  "metrics": {
    "tempC": 38.7,
    "heartBpm": 68,
    "spo2": 97,
    "activity": {"steps": 120, "restMin": 45},
    "batteryV": 3.9,
    "gps": {"lat": 26.85, "lng": 80.95, "acc": 8}
  },
  "fwVersion": "1.0.3",
  "signal": {"rssi": -62}
}

Device Security:
- Per-device bootstrap token (from server) used during first pairing
- Short-lived signed telemetry token (JWT) rotated by device shadow
- TLS to MQTT broker (mutual TLS optional); pinned CA
- Anti-replay: ts + nonce

Android — Device Management Module:
- BLE scan & connect; provisioning (SSID/PWD, cattle link)
- Read device info; push config (intervals/thresholds)
- Re-assign to different cattle
- Live vitals dashboard; historical charts; alert center
- Firmware screen: check update, trigger OTA, progress
- Device shadow sync: desired vs reported state

Backend — iot-telemetry-service:
- MQTT ingest → validate → normalize → store
- MongoDB TimeSeries: measurements by deviceId/cattleId
- Shadow store for device state/config
- OTA service: firmware versions, staged rollout, canary by % or tag
- Webhooks/events → ai-service for scoring
- Notify farmer via FCM/WebSocket on alerts/anomalies
- Admin APIs: fleet list, last seen, battery, fwVersion, rollout status

AI (health/feed/market):
- Rule-based + ML hybrid (pluggable)
- Detect: heat stress, mastitis signals, inactivity anomalies
- Output: risk score 0–1, label, recommended action
- Surfaces in farmer app; Pro/Enterprise only

Marketplace Tie-in:
- ESP32 device sold in marketplace (commissionable)
- Link purchase → activation → device assignment
- Warranty & activation history

=====================
8) HELPER MANAGEMENT
=====================
Android:
- Module: :feature-helper
- Compose screens: HelperList, AddHelper, MarkAttendance, LedgerView, SalarySlipPreview, CertificatePreview
- Fast batch attendance (Full/Half/Absent/OT)
- Auto salary calc; advances ledger; carry forward
- Generate & share bilingual PDF payslips and experience certificates
- Access by subscription (Free up to 2 helpers, Pro unlimited + PDFs)

Backend — labor-service:
- Collections: helpers, attendance_records, advance_ledger, salary_slips
- APIs:
  - POST /helpers
  - GET /helpers?farmerId=
  - POST /helpers/{id}/attendance
  - POST /helpers/{id}/advance
  - POST /helpers/{id}/generate-salary-slip?month=YYYY-MM
  - POST /helpers/{id}/experience-certificate
  - GET /helpers/{id}/ledger
- Salary calc via MongoDB aggregations (attendance × wage rules + OT + advances)
- PDF generator (reportlab/pdfkit) bilingual templates; store in S3; return URL
- Webhooks/notifications: payroll closed, payslip ready

===========================
9) ADVANCED MILK PRICING
===========================
Goal: Let farmer manage breed-wise rates, time-bound validity, daily overrides, and FAT/SNF formula-based pricing. Auto-apply correct rate to milk entries and earnings.

Pricing Methods (per farmer, per breed):
1) Fixed Rate per Breed:
   - A simple rate (₹/L) with validity period (startDate, optional endDate)
2) Daily Rate:
   - Farmer manually enters a date-specific rate; overrides fixed/formula if present
3) FAT/SNF Formula-Based:
   - Farmer defines a custom formula to compute rate from FAT/SNF (and optional variables)
   - Example: RATE = (FAT * fatMultiplier) + (SNF * snfMultiplier) + fixedBonus
   - Formula customizable per breed; persisted as JSON expression

Data Model — milk_rates:
- { farmerId, breed, pricingType: "fixed"|"daily"|"formula",
    fixedRate?, formulaJSON?, startDate, endDate?, createdAt }
- For daily rate mode, store separate collection milk_daily_rates:
  { farmerId, breed, date, rate }

Formula JSON example:
{
  "type": "formula",
  "formula": "({FAT} * 10) + ({SNF} * 5) + 2",
  "variables": ["FAT","SNF"],
  "multipliers": { "FAT": 10, "SNF": 5 },
  "bonus": 2
}

Calculation Rules:
- When logging milk:
  - If a daily rate exists for the date → use it
  - Else if an active formula exists → require FAT/SNF inputs and evaluate
  - Else if an active fixed rate exists → use it
  - On overlaps, latest created with valid period wins (server-enforced)
- Earnings = quantity * appliedRate
- Show rate breakdown (e.g., "FAT 4.1%, SNF 8.5% → ₹61.5/L")

UI (Android :feature-milk-rate):
- RateListScreen (per breed), AddRateScreen (Fixed/Formula), Calendar for Daily Rate
- During milk entry:
  - If formula applies → prompt FAT/SNF; show calculated rate with breakdown
  - If daily rate exists → prefill and lock rate (editable with permission)
- Analytics: charts for rate changes, earnings per breed, effect of FAT/SNF

Backend — milk-rate-service:
- APIs:
  - POST /milk-rate (create/update fixed or formula)
  - GET /milk-rate?farmerId=
  - POST /milk-rate/daily (date, breed, rate)
  - GET /milk-rate/daily?farmerId=&from=&to=
  - POST /milk/apply-rate (given farmerId, breed, date, optional FAT/SNF → return rate and breakdown)
- MongoDB aggregations to select applicable rate
- Validation to prevent contradictory overlapping periods

AI (Future-Ready):
- Predict next-day rate using historical FAT/SNF and market trend features (placeholder endpoint)
- Suggest multipliers for better earnings based on past data (advisory only)

=============================
10) OUTPUT & DELIVERY FORMAT
=============================
When generating, follow this order and include COMPLETE, BUILDABLE code:

A. Architecture diagram (text + mermaid)
B. Folder trees for:
   - Android Main App
   - Delivery Android App
   - Angular Admin
   - Each Node microservice (incl. labor-service, milk-rate-service, iot-telemetry-service)
   - KMP shared modules
   - ESP32 firmware (Arduino/C++)
C. KMP Shared:
   - :shared-models (Cattle, Listing, Order, Wallet, Subscription, HealthRecord, Telemetry, DeviceShadow, FeedSku, Helper, AttendanceRecord, AdvanceEntry, Payslip, MilkRate, MilkDailyRate)
   - :shared-usecases (AddCattle, RecordMilk, CreateListing, PlaceBid, WalletTopUp, LinkDevice, FetchVitals, RunHealthAnalysis, AddHelper, MarkAttendance, GeneratePayslip, GenerateCertificate, SetMilkRate, SetDailyRate, ApplyMilkRate)
   - :shared-domain interfaces + validators + mapping DTOs
   - expect/actual for datetime/logging/network reachability
D. Android Main App — implement end-to-end for:
   1) Gradle + dependencies + DI
   2) Navigation shell + Auth flow (OTP + Google) + Subscription gating
   3) Herd, Wallet, Marketplace, Feed modules
   4) Device module (BLE provisioning, live vitals, history, OTA)
   5) Helper module (attendance, advances, PDFs)
   6) Milk Rate module (fixed/formula/daily + earnings integration)
   7) Room schema + DAOs + Repos + Sync workers
   8) Retrofit/Ktor API clients (placeholder URLs)
   9) Compose screens, ViewModels, UseCases (per feature)
   10) Unit/UI tests (≥1 per feature)
E. Delivery App:
   - Login → task list → pickup → POD; offline queue
F. Angular Admin:
   - Workspace + guards + interceptors
   - Pages: Dashboard, Approvals, Subscriptions, IoT Devices (incl. OTA), Helpers & Payroll, Milk Pricing
G. Backend (each microservice):
   - package.json, tsconfig, Dockerfile, .env.sample
   - Mongoose models, controllers, routes, validation, Swagger
   - Seeds + sample data; payment webhook mock
   - Socket.IO channels for bids/chat/device alerts
H. IoT Telemetry Service details:
   - MQTT consumer, HTTP fallback endpoints
   - TimeSeries collection, retention policies, indexes
   - Device shadow model; OTA endpoints; staged rollout
   - Example firmware signing/checking flow
I. ESP32 Firmware (Arduino/C++):
   - src/main.cpp with BLE provisioning, WiFi manager, MQTT client, OTA, sensor drivers stubs
   - config.h (pins, topics, intervals), secrets placeholder, platformio.ini or Arduino CLI
   - Unit-testable sensor parsing functions
J. Postman collection + example environment (.env)
K. README: local dev with docker-compose (broker + API + Mongo + Redis) and mobile/firmware setup steps

====================
11) CODING STANDARDS
====================
- Enforce Clean Architecture boundaries
- Dependency inversion: UI → domain interfaces only
- Robust error handling (network/offline, validation)
- Strong typing; constants/enums; no magic strings
- Localization-ready strings (EN/HI)
- Security first (token scopes, input validation, TLS)
- Provide sample .env and seed data so it runs locally
- Add TODO where real integrations are mocked

Begin by printing ONLY:
1) The full folder structures for all apps/services (including ESP32 firmware)
2) A mermaid diagram of the architecture
Then proceed module-by-module starting with:
- KMP shared modules
- Android Main App: Auth + Subscription gating
- Backend: auth-service (users, roles, subs, referrals)
- IoT: iot-telemetry-service scaffold + MQTT topics/contracts
- Labor: labor-service scaffold + salary calc pipeline
- Milk Pricing: milk-rate-service scaffold + apply-rate endpoint
(Stop after these and wait for next instruction)

========================
12) CATTLE LIFECYCLE MANAGEMENT & ANALYTICS
========================
Enhance the Cattle Management module to allow farmers to track full cattle lifecycle events with media support and advanced analytics.

Features:
- Add/Edit Cattle:
  - Fields: tagNumber, breed, category (Cow/Buffalo/Heifer/Bull), lineage (sire/dam), DOB/age, purchase cost, milk capacity, temperament, RFID/EarTag ID
  - Media upload: multiple images + videos (stored in S3-compatible storage)
  - Assign ESP32 device (optional)
- Cattle Detail Page:
  - Tabs:
    1) **Overview**: breed, age, current status (milking/pregnant/dry), weight, device connected?, profitability summary
    2) **Milk Trends**: daily yield chart, filter by date range, show earnings from pricing module
    3) **Calving History**: list of calvings with date, calf gender, outcome, assisted/normal, days open (AI suggestion for next insemination)
    4) **Breeding/Insemination History**: insemination attempts (date, method, bull ID, success/failure, pregnancy check result), next pregnancy reminder 
    5) **Medicine & Vaccination History**: events log with date, name, dose, administered by, cost, next due reminder
    6) **IoT Health (if device assigned)**: live vitals (temp, heart rate, activity), historical graphs, alerts (heat stress, inactivity, mastitis signals)
    7) **Expenses & Profitability**: feed cost, treatment cost, helper allocation, milk income, net profit

Lifecycle Timeline View:
- Visual calendar of events tagged as: Calving, Insemination, Milk Milestone, Medication, IoT Alert
- Farmer can filter by category and time

Data Storage:
- Collections to include:
  - cattle
  - cattle_media
  - cattle_milk_records
  - cattle_calving_records
  - cattle_insemination_records
  - cattle_medicine_records
- Link all by cattleId

Analytics:
- Provide AI-driven insights such as:
  - Pregnancy probability score
  - Heat detection window
  - Ideal breeding timing suggestion
  - Milk decline early warning
  - Profit vs cost trend per cattle

UI/UX:
- Dedicated module: :feature-cattle-profile
- Compose screens with tabs and charts
- Integration with IoT telemetry, milk pricing engine, wallet, and helper allocation

Subscription Rules:
- Free tier: add up to 5 cattle; limited lifecycle analytics
- Pro tier: unlimited cattle + full analytics + AI insights

===============================
13) CATTLE LIFECYCLE, CALF MGMT & PDF HISTORY
===============================
Enhance the cattle module with generational lifecycle tracking from birth to sale/death, including calf creation and automatic stage transitions, with exportable PDF history.

Calving & Calf Creation:
- From a calving record, allow one-tap creation of a Calf profile.
- Auto-fill fields: parentId (mother), breed (derived from parents, editable for cross-breed), birthDate/time, gender, birthWeight (optional), calving notes.
- Media at birth: upload multiple images/videos; store in S3-compatible storage.
- Category for newborn: CALF (separate Calf List).
- Optional sireId (bull) linkage for genealogy and breeding analytics.

Lifecycle Transitions:
- Auto or manual transitions by rules:
  - CALF → HEIFER or BULL based on age threshold (configurable, e.g., 12–18 months) or farmer confirmation.
  - HEIFER → MILKING (COW/BUFFALO) after first calving.
  - MILKING → DRY at end-of-lactation (app prompts end-of-lactation flow).
- App shows remaining days to maturity or expected calving window.
- AI hints: heat detection windows, ideal insemination timing, expected dry-off date.

End-of-Lactation Flow:
- On marking end of lactation, update lifecycle stage to DRY.
- If calf was created at last calving and is at/near maturity window, prompt to promote CALF → HEIFER.

Archival Events (Sold/Death):
- Actions: Mark as Sold (date, price, buyer details, payment mode, notes) or Mark as Deceased (date, cause, notes).
- Move cattle to Archived with full history intact; exclude from active lists and calculations (unless explicitly included in filters).

Lifecycle Timeline & Analytics:
- Per-cattle timeline: Birth → Heats → Inseminations → Pregnancies → Calvings → Lactations → Treatments/Medicines/Vaccines → IoT Alerts → Sale/Death.
- Show milk trends overlay and profitability snapshots per lactation.
- Genealogy view (future-ready): parent-child tree; placeholders for inbreeding warnings and breeding recommendations.

Database & Backend:
- Collections:
  - cattle { id, tagNumber, category, status, parentId?, sireId?, birthDate, breed, lifecycleStage, purchaseInfo?, maturityDate?, saleOrDeathDate?, saleDetails?, media[] }
  - cattle_lifecycle_events { cattleId, eventType, date, value?, notes?, parentEventId? }
  - calves (optional staging) or flag within cattle until promotion; ensure atomic promote CALF→HEIFER.
- Endpoints (herd-service):
  - POST /cattle/{id}/calving (with option createCalf: true)
  - POST /cattle/{id}/promote (CALF→HEIFER, HEIFER→MILKING, etc.)
  - POST /cattle/{id}/archive/sold
  - POST /cattle/{id}/archive/deceased
  - GET /cattle/{id}/timeline
  - GET /cattle/{id}/summary

PDF Exports:
- Generate bilingual (EN/HI) **Cattle Lifecycle Summary PDF** with:
  - Identity (tag, breed, DOB), genealogy (dam/sire), media thumbnail, IoT device link (if any)
  - Milk yield trends per lactation with dates
  - Calving history, inseminations, pregnancy checks
  - Medicine & vaccination history
  - Cost vs income mini-statement and profitability per lactation
  - QR code to verify summary online (placeholder)
- Endpoint:
  - POST /cattle/{id}/export-summary (returns S3 URL)
- Templates with farmer logo/signature; support watermark for “Archived / For Sale”.

UI/UX (Android):
- Tabs in Cattle Detail: Overview, Milk Trends, Calving, Breeding, Medicines, IoT, Expenses/Profit, **Timeline**, **Documents**.
- Calf List with quick maturity status; one-tap promote.
- Archived list with filters (sold/deceased/reason/date).
- Share/download PDF from Documents tab.

Subscriptions:
- Free: lifecycle tracking limited (no PDF export; no genealogy), up to 5 active cattle.
- Pro: unlimited lifecycle, PDF exports, genealogy preview, AI hints.

===============================
14) CATTLE HUB (MARKETPLACE WITH MEMBERSHIP CONTROL)
===============================
Features:
- Marketplace where farmers can list cattle for sale in two modes:
  1) Normal Sale (fixed price)
  2) Bid Sale (auction with starting price, reserve price, minimum increment, bid end time)

Listing from Cattle Profile:
- On cattle detail page, farmer can click "List for Sale"
- Choose mode: Normal/Bid
- Upload/update media, set price/bid parameters
- Listing preview & publish

add a "Watchlist" feature

Membership Plans:
1. Free Member (Basic):
   - Can view cattle thumbnails and basic information (breed, age, location)
   - Cannot view detailed reports (milk yield, IoT health, breeding history)
   - Cannot buy or bid
   - Upgrade prompt shown when attempting to access

2. Gold Member:
   - Can view detailed reports of up to 4 different cattle per month
   - Can buy up to 2 cattle per month
   - Can participate in bids
   - Access AI basic recommendations
   - Listing limit: 3 active listings

3. Platinum Member:
   - Can view up to 10 detailed reports per month
   - Can buy up to 5 cattle per month
   - Priority in bidding (tie-break advantage)
   - Unlimited listings
   - Advanced AI recommendations + breed profit prediction
   - Verified Seller & Premium Listing Badge

Anti-Trader Controls:
- KYC verification required for Gold/Platinum
- Monthly purchase caps strictly enforced
- Suspicious activity flagged for admin review

Additional Features:
- Escrow wallet payment system for safe transactions
- Farm visit request scheduling (in-person or video inspection)
- AI-driven recommendation system
- Rating & review system for buyers and sellers
- Verified Cattle Badge (optional paid service)

Backend Requirements:
- New microservice: marketplace-service
- Collections:
  - marketplace_listings
  - bids
  - view_logs (track usage vs membership limits)
  - transactions/escrow
- APIs:
  - POST /listings
  - GET /listings?filter=
  - POST /listings/{id}/bid
  - POST /purchase/{id}
  - GET /membership/usage
  - GET /recommendations
- Auto-expiry of bid listings at end-of-time
- Notification triggers for outbid events, bid win, listing expiry, payment success

UI:
- Home tab: Cattle Hub Marketplace
- Filters: breed, price range, location, milking status, fat %, IoT health
- Listing badges: New / Verified / Premium / On Bid
- Detailed view gated by membership

Subscription:
- Gold and Platinum plans integrated with payment gateway and subscription logic

===============================
CATTLE HUB ELIGIBILITY RULES (ADD TO SECTION 14)
===============================
Eligibility for Listing:
- A cattle can be listed in Cattle Hub only if it has a minimum of 12 months of recorded history (milk, health, breeding).
- System must validate history completeness before allowing listing.
- If cattle < 12 months of logs → prompt user: "Cattle not eligible for marketplace yet. Continue logging to build sale eligibility."

Eligibility for Normal Sale:
- Any verified cattle with one-year complete history can be listed with fixed price.

Eligibility for Bid Sale:
- Additional restrictions:
  - Cattle must be in 1st, 2nd, or 3rd lactation only
  - Cattle must be currently MILKING or PREGNANT
  - Verified one-year digital history must exist
  - If cattle is in 4th lactation or beyond → show "Not eligible for bidding, only direct sale allowed"

Badging System:
- Verified History Badge: automatically assigned after 12 months of continuous logging
- Prime Breed Badge: assigned if under 3rd lactation and milking/pregnant
- Elite Badge: assigned if IoT telemetry enabled and no disease alerts in last 6 months
- Low Confidence Badge: assigned if records are incomplete or inconsistent

Admin override:
- Admin can manually verify and approve cattle for premium listing based on inspection (future feature with service fee)

Membership Impact:
- Only Gold and Platinum users can list cattle
- Platinum users get priority visibility in marketplace feeds
- Basic users can list only after KYC + one-time activation fee

===============================
VERIFICATION SCORE & AI TRUST RANKING
===============================
Implement an AI-based verification score system (0–100) for every cattle eligible for sale.

Scoring Parameters (Weight Based):
- Milk Productivity (30%): average milk yield, consistency across last lactation period
- Reproductive Efficiency (20%): insemination success rate, calving interval analysis
- Medical Health (15%): vaccination compliance, disease incidents, medicine usage patterns
- Age/Lactation Stage (10%): optimal stage (1st-3rd lactation get highest points)
- IoT Health Stability (10%): temperature, heart rate, rumination patterns, stress alerts
- Profitability (10%): milk income vs expense trend
- Data Completeness (5%): continuous digital logs, no major data gaps

Score Categories:
- 90–100: "Elite Verified" (badge color gold) → Top priority in search results, eligible for auction
- 75–89: "Prime Verified" (badge color green) → Eligible for auction and premium listing
- 50–74: "Standard" (badge color blue) → Only normal sale allowed
- 0–49: "Low Confidence" (badge red) → Not eligible for marketplace

Marketplace Ranking Impact:
- Listings sorted based on verification score + freshness + membership status (Platinum > Gold)
- Buyers can filter by score range (e.g., Elite only)

AI Engine Implementation:
- Run scoring engine whenever:
  - Cattle is listed
  - New calving/insemination/medical/milk record is added
  - IoT device reports abnormal vitals
- Expose scoring as endpoint:
  - POST /cattle/{id}/calculate-score
  - GET /cattle/{id}/score
- Admin must be able to override score (audit logged)

Display in UI:
- Verification Score meter (progress bar with badge)
- Breakdown of parameters for transparency
- Tooltip: "Score based on milk productivity, calving history, health stability"

===============================
VIDEO VERIFICATION & TOKEN BOOKING
===============================
Introduce a secure booking system:

- Buyers can pay a token amount (default 10%, configurable by seller or platform).
- Once token is paid, cattle is reserved and hidden from other buyers until verification is completed or time expires.
- Buyer is prompted to initiate an in-app video call for live verification.
- After video call:
  - Buyer can confirm purchase → proceed to escrow payment.
  - Buyer can reject → token refund initiated based on policy.

Verification Policy Based on Score:
- Elite Verified cattle (score ≥90 with 1-year full history): Video verification is optional. Buyer may directly proceed to full payment ("Instant Buy").
- Prime Verified cattle (score 75–89): Video recommended but optional.
- Standard Verified cattle (score 50–74): Video verification is mandatory after token booking.
- Low Confidence cattle (<50): Not eligible for marketplace.

Escrow Logic:
- Token paid into escrow wallet
- Full payment required within a deadline (configurable, e.g., 48 hours)
- Auto refund or token forfeiture can be rules based on rejection reason

Admin Settings:
- Admin can configure platform fee, token percentage, refund policy.

===============================
15) FARM EXPENSE & INCOME MANAGEMENT
===============================
Introduce a complete financial module to calculate expenditure, income, and profitability at both farm level and per-cattle level.

Expense Types:
- Daily Expenses: feed, fodder, power, water, labor
- Monthly Recurring Expenses: helper salaries, loans, rent, insurance premium
- Seasonal Expenses: silage preparation, seasonal fodder stock, land preparation
- Cattle-Specific Expenses: insemination, medicine, vaccination, treatment, pregnancy test

Expense Allocation Modes:
- Equal per cattle
- Based on milk production weightage (more productive cattle get higher expense allocation)
- Specific cattle only

Income Sources:
- Milk income (auto-calculated based on pricing engine)
- Cattle sale income (from marketplace)
- Other manual income (manure, rental, contract-based)

Helper Expenses:
- Daily wages or monthly salaries
- Distributed automatically in expense model

Analytics:
- Per-cattle profitability view
- Daily, monthly, and seasonal financial dashboards
- Lactation-wise profitability trend
- Forecast of future expenses and expected milk income using AI

UI (Android Module: :feature-expense-income):
- Expense Entry Screen (select type, amount, date, description, allocation rule)
- Income Dashboard (list, charts, per-cattle summary)
- Profitability Report Screen (Net profit per cattle, Top 5 profitable cattle, loss-making cattle alert)

Backend:
- Collections: expenses, income, expense_allocation, cattle_profit_records
- Monthly calculation via cron job or on-demand
- APIs:
    POST /expenses
    GET /expenses?farmerId=
    GET /profitability?cattleId=
    GET /farm-summary?farmerId=
- AI recommendations for cost savings and yield improvement

==========================================
16) AI REVENUE PLANNER, CREDIT & FODDER OPS
==========================================
Goal: Provide actionable, data-backed recommendations to increase farmer income through
(a) herd size optimization (buy X cows/buffalo),
(b) safe credit limit prediction to finance purchases,
(c) green fodder cultivation plan to reduce feed cost.

Inputs (auto + manual):
- Current herd: count by breed, average milk yield, lactation stages
- Pricing model: breed rates / daily / FAT-SNF formula
- Costs: feed (dry + green), helper costs, seasonal expenses, medicine
- Land (optional): owned acres/hectares, irrigation type, seasons available
- Historic cashflow: last 3–12 months income/expenses
- Local forage yields (defaults): e.g., hybrid napier 40–60 t/acre/year; maize 10–15 t/acre/cycle (overrideable in Admin)
- Finance settings: target EMI/Revenue ratio, interest %, tenure presets

16.1 Herd Growth Recommendation (What-If Simulator)
- Compute marginal profit per additional animal by breed (Buffalo, Murrah, Sahiwal, Jersey) using:
  ExpectedMonthlyProfit = (ExpectedYieldL/day × 30 × ExpectedRate) – (FeedCost + Health + LaborShare + OtherAllocations)
- Recommend "Add N cows/buffalo" where DSCR ≥ 1.2 and monthly cashflow remains positive.
- Show projected uplift, e.g., “+₹10,000/month with +2 Murrah buffalo”.
- Consider constraints: housing, helper capacity, fodder availability; warn if insufficient.
- UI: slider to add 0–10 animals per breed; live charts for profit uplift and payback period.
- Output: table (breed, qty, CAPEX, monthly EMI, net profit change, break-even months).

16.2 Credit Limit Prediction (Responsible Lending Helper)
- Predict safe credit limit using:
  - Average Net Monthly Income (last 6–12 months)
  - Variance/seasonality penalty
  - Existing EMIs/obligations
  - DSCR target (default 1.2) and FOIR cap (e.g., EMI ≤ 35% of Net Income)
- Compute recommended Max EMI and resulting loan principal given interest & tenure.
- Provide ranges: Conservative / Standard / Aggressive.
- Expose lender-friendly summary (cashflow, DSCR, recommended limit, purpose).
- Disclaimer: “Advisory only; not a loan sanction.”

16.3 Green Fodder Optimization (Land-Aware Cost Saver)
- If land present: build crop plan (Napier/CO-4/maize/berseem based on season) to meet target % of herd daily dry-matter needs.
- Estimate savings:
  MonthlyFeedSaving = (CurrentPurchasedFeedCost – ProjectedFeedCostWithGreen)
- Compute required area by crop and season; show irrigation schedule & cutting cycle.
- Suggest “Grow X acres napier to replace Y% purchased feed; save ₹Z/month.”
- If no land: suggest contract green fodder or silage buying plan.

16.4 Scenario Engine & AI Tips
- Prebuilt scenarios: “Add 2 Murrah”, “Add 3 Sahiwal”, “Grow 0.5 acre napier”, “Mixed plan”.
- AI tips:
  - “Shift 20% ration to green fodder to save ₹____/month”
  - “Stagger purchases to keep DSCR > 1.2”
  - “Delay expansion until post-harvest cash inflow”
- Export scenario as PDF for bank/investor.

Backend (ai-service & herd-service collaboration):
- POST /ai/revenue-planner/simulate  {herd, prices, costs, land, scenario[]}
- GET  /ai/revenue-planner/default-scenarios
- POST /ai/credit-limit {cashflow, existingEmi, interest, tenure, targets?}
- POST /ai/fodder-plan {land, herd, seasons, yieldAssumptions?}
- Admin: PUT /ai/yield-presets (per region/crop), PUT /ai/rules (DSCR, FOIR)

Models (KMP shared + backend DTOs):
- RevenueScenario { id, name, adds: [{breed, qty}], capex, assumptions }
- CreditLimitAdvice { conservative, standard, aggressive, maxEmi, dscr }
- FodderPlan { crops: [{name, area, cycles, yieldTons, season}], savingsPerMonth }
- ProfitProjection { month, baselineProfit, projectedProfit }
- Assumptions { milkRateSources, feedPrices, interest, tenure, dscrTarget, foirCap }

UI (Android :feature-ai):
- Planner Home: baseline KPIs (profit, DSCR, feed cost share)
- What-If Simulator: sliders/selectors, live profit & cashflow chart
- Credit Card: “Safe credit limit ₹__ (EMI ≤ __/mo)”
- Fodder Card: “Grow __ acres napier → save ₹__/mo”
- “Apply Scenario” writes planned purchases to marketplace watchlist and creates TODOs.

Subscription:
- Free: read-only baseline KPIs
- Gold: herd simulator (single scenario), credit advice basic
- Platinum: multi-scenario compare, fodder optimizer, PDF export, lender report

===============================
17) WALLET ESCROW, RESERVATION & AUTO-SETTLEMENT SYSTEM
===============================
Enhance the wallet module to function as an escrow-based digital ledger with reservation and settlement capabilities.

Marketplace Orders (Feed, Medicines, Equipment):
- Wallet balance must be ≥ total order amount before checkout.
- On placing order:
   - Amount is marked as "RESERVED" in wallet (not deducted yet).
   - Reserved amount cannot be used for other transactions.
- On successful delivery:
   - Reserved amount is converted to "DEDUCTED".
   - Settlement rule: payment transferred to supplier (minus commission if applicable).
- If order fails/cancelled:
   - Reserved amount is released back to available balance.

Cattle Hub Purchase Flow:
- Buyer pays 10% token from wallet → reserved as TOKEN_ESCROW.
- Before final transaction, wallet must have 100% cattle price.
- Once delivery is confirmed:
   - Full payment is deducted from wallet.
   - Seller receives payout = cattlePrice - platformCommission.
   - Cattle record is digitally transferred from seller’s farm profile to buyer’s farm profile automatically.
- If deal is cancelled before final payment:
   - Token is refunded (configurable with penalty rules if seller/buyer is at fault).

Wallet States:
- AVAILABLE_BALANCE
- RESERVED_BALANCE
- TOKEN_ESCROW
- WITHHELD_FOR_COMMISSION

Digital Transfer of Cattle Ownership:
- Upon settlement, data is moved:
   - seller.cattleList.remove(cattleId)
   - buyer.cattleList.add(cattleId)
- Lifecycle history remains intact and transferred to new owner as “Imported cattle”.

Farmer Wallet Dashboard:
- Show total spend on feed & cattle
- Show earnings from cattle sales
- Show reserved vs available balance
- Show commission deductions
- Show purchase/sales statistics:
   - cattlesPurchasedCount
   - cattlesSoldCount
   - totalCommissionPaid
   - totalProfitFromSales

API Changes (wallet-service & marketplace-service):
- POST /wallet/reserve
- POST /wallet/release
- POST /wallet/settle
- GET /wallet/activity-log
- Integration with marketplace-service on order lifecycle events.

UI Integration:
- While ordering or booking, show:
   “₹X will be reserved in your wallet until delivery.”
- Display reservation badge in wallet transaction history.

Subscription Logic:
- Platinum/GOLD users get priority settlement
- Free users have slower settlement times (future enhancement)

===============================
17.1 PENALTY & FORFEIT RULES FOR ESCROW TOKEN
===============================
Cancellation Scenarios:

Case 1: Buyer Cancels After Token Reservation
- Gold/Platinum:
   - 1 free cancellation per month → full token refund
   - Subsequent cancellations → 90% refund, 10% platform retention as penalty
- Free Member:
   - 80% refund
   - 20% forfeited as cancellation fee to platform
- Repeated cancellations tracked; system may temporarily disable booking privileges.

Case 2: Seller Cancels After Token Reservation
- Seller deemed at fault.
- Seller pays penalty = 1.5 × token amount (deducted from wallet or future sale earnings).
- Buyer refunded 100% of token.
- Buyer also receives compensation bonusCoins from platform's penalty revenue.
- Seller receives warning; repeated offenses result in ban or forced downgrade from Platinum.

Case 3: Logistics Failure or Mutually Agreed Cancellation
- Token remains reserved or refunded based on final settlement rules agreed by both parties.
- Partial penalty may be applied to seller if fault determined via admin review.

Implementation:
- wallet-service maintains token in special ESCROW state with owner references.
- marketplace-service logs cancellation events and triggers penalty calculation logic via POST /wallet/apply-penalty.
- admin-service receives alert to review dispute if needed.

Penalties & Retention:
- Platform may retain part of penalty as revenue
- Rest may be distributed as loyalty reward coins to buyer

===============================
18) FUTURE ENHANCEMENTS & GLOBAL ROADMAP
===============================

18.1 AI-Powered Insurance & Credit Scoring (Phase 1.5)
- Real-time creditworthiness based on herd productivity, verification score, revenue trends
- Auto insurance policy generation and premium deduction via wallet
- API integrations with NBFCs and government dairy credit schemes (PM-Kisan, NABARD)
- Generates recurring commission for platform

18.2 AI Breeding & Genetic Optimization 
- Suggests best semen/bull based on milk yield genetics, climate compatibility, disease resistance
- Predicts milk increase, calving success probability, generational profitability uplift
- Provides “Genetic Improvement Score” for each cattle

18.3 Cattle Digital Identity on Blockchain (Phase 2.5)
- Immutable cattle record ledger
- Enables export, government subsidy eligibility, insurance claim authenticity
- NFT-based tokenization of elite cattle (future-ready feature)

18.4 Carbon Credit & ESG Income (Phase 3)
- Tracks methane reduction using IoT vitals & feed type
- Calculates carbon credits per animal using FAO standards
- Allows farmers to earn credits & sell them on carbon markets
- Positions Godhan as a certified climate-positive dairy network

Implementation Notes:
- Build as modular microservices to plug into existing data streams
- Add admin control to enable/disable features by region or government mandate
- AI service to be expandable with ML models integrated over time

# 🚀 Section: Patentable AI & IoT Innovation Integration Prompt (Core Engine Directive)

This section defines core patentable systems that MUST be integrated deeply into the Godhan Platform architecture. These innovations are not optional features – they are strategic IP pillars designed to ensure long-term monopoly, investor appeal, and global scalability.

---

## 🔷 **1. Cattle Digital Twin with Self-Evolving AI Identity**
**Directive:**  
Implement a virtual AI-based digital identity for every cattle in the system.

### ✅ Features Required:
- Learns continuously from:
  - IoT vitals (temperature, heart rate, rumination, activity)
  - Milk yield trends and lactation stage
  - Breeding outcomes, calving intervals
  - Expense vs income contribution
- Generates:
  - **Cattle Health Confidence Index™**
  - **Cattle Profitability Index™**
  - **Predicted lifecycle curve** (heat cycle, dry period, lifespan)
- Uses **federated learning** to improve models without exposing user data.
- This AI twin must directly influence marketplace eligibility, pricing, creditworthiness, and carbon credit generation.

---

## 🔷 **2. Dynamic AI-Based Escrow & Adaptive Settlement Engine**
**Directive:**  
Replace static escrow with intelligent AI-driven settlement rules.

### ✅ Features Required:
- Escrow rules dynamically change based on:
  - Cattle’s AI Verification Score (from digital twin)
  - Buyer/seller credibility history
  - IoT sensor readings during transport
- Automatically adjusts:
  - Settlement release time
  - Commission percentage
  - Reserve/token amount
  - Risk flags and fraud alerts

This becomes a **self-learning trust mechanism** rather than a fixed payment system.

---

## 🔷 **3. AI Breeding Optimization & Genetic Profit Prediction**
**Directive:**  
Enable predictive breeding economics and genetic selection.

### ✅ Features Required:
- Predict economic return of each insemination before execution.
- Suggest ideal semen/bull choice based on:
  - Genetic traits
  - Climate adaptation
  - Expected milk uplift
  - Feed cost economics
- Generate **Expected Calf Profitability Score™** and store in cattle’s digital identity.


## 🔷 **4. Self-Optimizing Farm Economy Engine (AI CFO Mode)**
**Directive:**  
Godhan must function as an autonomous financial optimizer for farmers.

### ✅ Features Required:
- Analyze:
  - Milk income vs feed cost vs labor vs EMI
  - Marketplace cattle prices
  - Herd expansion opportunities
- Suggest:
  - How many cattle to buy/sell
  - When to leverage credit
  - Green fodder vs commercial feed strategies
- Generate automated business plans:
  - **Auto-Farm Expansion Plan™**
  - **ROI projections**
  - **Profitability alerts**

This becomes the farmer’s **AI Chief Financial Officer**.

## 🔷 **5. IoT-Based Carbon Credit Generation Engine**
**Directive:**  
Integrate methane emission tracking and carbon monetization at cattle-level.

### ✅ Features Required:
- Use IoT vitals + feed efficiency to calculate **methane intensity**.
- Compare with baseline to compute **CO₂e reduction**.
- Mint **Carbon Credits** automatically.
- Credit farmer wallet monthly.
- Display real-time **Carbon Revenue Dashboard** in app.

This innovation positions Godhan as the **first ESG-positive livestock platform globally**.


## 🔷 **6. Universal Cattle Identity Ledger (Blockchain Ready)**
**Directive:**  
Create a tamper-proof cattle identity and ownership system that persists for the life of the animal.

### ✅ Features Required:
- Each cattle gets a **Digital Identity Token**.
- Every lifecycle event (birth, insemination, milk record, sale, death) must be recorded as an immutable log.
- Ownership transfers must issue **Digital Transfer Certificates with QR verification**.
- Ready for future blockchain integration (non-crypto NFT identity).


## 📌 Core Integration Requirement
> **All Godhan modules – including Farmer App, Cattle Hub, Marketplace, IoT Firmware, Admin System, Wallet, Carbon Engine, and AI Services – MUST interface with and be driven by these patentable systems. These AI & IoT components are the central nervous system of the platform.**

### ✨ Strategic Importance:
- Creates **decentralized livestock intelligence network**
- Ensures **platform lock-in and non-replicability**
- Enables **multi-billion dollar valuation through IP protection**
- Supports **global carbon trading, insurance underwriting, and livestock financing**


## ✅ Final Directive (To AI or Development Team)
**“Build every feature, from cattle registration to marketplace trading, in a way that continuously feeds into and consumes intelligence from these patented systems. These AI engines must power decision-making, pricing, eligibility, compliance, and revenue models throughout the platform.”**

