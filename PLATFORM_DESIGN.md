# Godhan Platform Design Document
**Version:** 1.0 | **Date:** 2026-05-07 | **Status:** Authoritative Reference

---

## Table of Contents
1. [Platform Vision](#1-platform-vision)
2. [Three-Phase Rollout](#2-three-phase-rollout)
3. [User Management](#3-user-management-user-service)
4. [Cattle Hub](#4-cattle-hub-cattle-service)
5. [Expenses Module](#5-expenses-module)
6. [Wallet](#6-wallet-wallet-service)
7. [Notifications](#7-notifications-notification-service)
8. [Referral Module](#8-referral-module)
9. [Membership & Coins](#9-membership--coins)
10. [Marketplace](#10-marketplace-marketplace-service)
11. [Helper Management](#11-helper-management-helper-service)
12. [Reports & Analytics](#12-reports--analytics-report-service)
13. [Micro-Hubs & Delivery](#13-micro-hubs--delivery)
14. [Dashboard (Home Screen)](#14-dashboard-home-screen)
15. [Business Model](#15-business-model)
16. [Implementation Priorities](#16-implementation-priorities)
17. [App Screens Inventory](#17-app-screens-inventory)

---

## 1. Platform Vision

Godhan is a **farmer-first agri-platform** that gives rural cattle farmers the tools, marketplace, and financial infrastructure previously available only to organized dairy businesses.

### Core Problems Solved
| Problem | Godhan Solution |
|---------|----------------|
| No cattle health records → low resale value | IoT collar + Digital Health Passport |
| Middlemen take 20–40% margin | Direct P2P marketplace with escrow |
| Unorganized helper wages → disputes | Helper management with salary slips |
| No access to quality feed/medicines | Verified input marketplace |
| Cattle sold without disease history | 6-month IoT history required before listing |
| No credit history for farm loans | Farm Health Score (IoT-backed) |

### Target Users
- **Farmers** — primary users; cattle owners managing 2–50 animals
- **Hubs** — local collection centers, verified resellers, input aggregators
- **Helpers** — day laborers and farm employees (managed by farmer accounts)
- **Admins** — platform operators managing verification, disputes, catalog

---

## 2. Three-Phase Rollout

| Phase | Name | Key Features | Target Milestone |
|-------|------|--------------|-----------------|
| **Phase 1** | Daily Utility | Cattle registration, milk logs, expenses, helper management, wallet, notifications | MVP launch |
| **Phase 2** | Marketplace + Growth | Feed/medicine marketplace, membership tiers, coins, referral, helper marketplace, report analytics | 3 months post-MVP |
| **Phase 3** | Ecosystem | Cattle P2P marketplace, auctions, micro-hubs, delivery, IoT grading, Digital Health Passport, Farm Health Score | 6–12 months |

---

## 3. User Management (user-service)

### Service Details
- **Port:** 3001
- **Module system:** ESM (`import`/`export`)
- **Database:** MongoDB via `godhan-core` `db.connectMongo`

### Authentication Flows

#### Email Registration
```
POST /auth/register/email
  → validate email + password
  → create user (status: pending)
  → send verification email (link with JWT token)

POST /auth/verify-email
  → verify JWT token
  → set user.emailVerified = true, status = active
```

#### Mobile (OTP) Login
```
POST /auth/send-otp     → generate 6-digit OTP, store in DB, send SMS
POST /auth/verify-otp   → verify OTP → issue access + refresh tokens
```

#### Google OAuth
```
GET /auth/google        → redirect to Google consent
GET /auth/google/callback → create/find user → issue tokens
```

#### Token Management
```
POST /auth/refresh      → validate refresh token → new access token
POST /auth/logout       → invalidate refresh token
POST /auth/set-password → for OAuth users setting a password
```

### User Model
```javascript
{
  name: String,
  email: { type: String, unique: true },
  mobile: { type: String, unique: true },
  password: String,           // bcrypt hashed
  role: enum["farmer","hub","admin"],   // USE THIS — not the duplicate below
  emailVerified: Boolean,
  mobileVerified: Boolean,
  status: enum["pending","active","suspended"],
  profilePhoto: String,
  address: { village, district, state, pincode },
  farmId: ObjectId,
  membershipTier: enum["free","silver","gold","platinum"],
  coins: { type: Number, default: 0 },
  referralCode: String,       // unique, auto-generated
  referredBy: ObjectId,
  isTrustedFarmer: Boolean,   // badge after 6-month IoT history
  createdAt, updatedAt
}
```

> **Bug:** User model has duplicate `role` field definition — the second definition (enum: ["user","admin"]) overwrites the first (enum: ["farmer","hub","admin"]). Fix: remove the second role definition.

### Routes Currently Active vs Planned
| Route | Status | Notes |
|-------|--------|-------|
| `/auth/*` | Active | All auth endpoints working |
| `/user/profile` | Commented out | Needs implementation |
| `/user/membership` | Commented out | Phase 2 |
| `/user/wallet-webhook` | Commented out | Phase 2 |
| `/user/upload` | Commented out | Profile photo upload |

### Trusted Farmer Badge Logic
- Farmer has IoT collar registered and active for ≥ 6 months
- `isTrustedFarmer = true` unlocks marketplace listing of cattle
- Badge shown on farmer profile and marketplace listings

---

## 4. Cattle Hub (cattle-service)

### Service Details
- **Port:** 3002 (assumed)
- **Module system:** CommonJS (`require`)
- **Base path:** `/cattle`

### Cattle Model
```javascript
{
  farmerId: ObjectId,         // ref: User
  tag: String,                // ear tag / RFID number
  type: enum["cow","buffalo","goat","sheep"],
  breed: String,
  age: Number,                // months
  weight: Number,             // kg
  lactation: Number,          // current lactation number
  isPregnant: Boolean,
  pregnancyStart: Date,
  expectedCalvingDate: Date,  // auto-calculated
  calvingHistory: [{ date, calfGender, complications, notes }],
  inseminationHistory: [{ date, method, bullBreed, veterinarianId, notes }],
  milkLogs: [{ date, morning, evening, total, fat, snf }],
  deviceId: String,           // IoT collar device ID (Phase 3)
  grade: enum["S","A","B","C","D"],   // IoT-computed (Phase 3)
  createdAt, updatedAt
}
```

### API Routes
| Method | Path | Description |
|--------|------|-------------|
| POST | `/cattle` | Register new cattle |
| GET | `/cattle` | List farmer's cattle |
| PUT | `/cattle/:id` | Edit cattle details |
| POST | `/cattle/:id/milk` | Log milk production |
| POST | `/cattle/:id/insemination` | Record insemination event |
| GET | `/cattle/:id/health-passport` | Get Digital Health Passport (Phase 3) |

### Calving Date Calculation
```
Cow:     pregnancyStart + 280 days
Buffalo: pregnancyStart + 310 days
```

### Feed Recommendation Formula
Based on NDRI guidelines:
```
Maintenance: 2% of body weight (dry matter)
Milk production: +0.4 kg DM per liter of milk
Pregnancy (last 2 months): +15% extra
```
Example for 500kg cow producing 10L/day:
```
= (500 × 0.02) + (10 × 0.4) = 10 + 4 = 14 kg DM/day
```

### Coins Earned (Phase 2)
| Action | Coins |
|--------|-------|
| Register cattle | 10 |
| Log milk (daily) | 2 |
| Record insemination | 5 |
| Calving recorded | 10 |
| Connect IoT collar | 50 |

---

## 5. Expenses Module

> Currently not implemented as a separate service. Should be added to cattle-service or as a standalone service.

### Expense Categories
- **Feed** — concentrate, green fodder, hay, silage
- **Veterinary** — vaccination, treatment, deworming, AI fee
- **Labor** — daily wages, helper salary
- **Infrastructure** — shed maintenance, equipment
- **Miscellaneous** — transport, electricity, other

### Data Model
```javascript
{
  farmerId: ObjectId,
  cattleId: ObjectId,         // optional (per-animal or farm-wide)
  category: enum["feed","vet","labor","infra","misc"],
  amount: Number,
  description: String,
  date: Date,
  receiptPhoto: String,       // S3/Cloudinary URL
  createdAt
}
```

### Views & Features
1. **Monthly summary** — category-wise pie chart
2. **Per-animal cost** — cost per liter of milk (profit/loss)
3. **Year-over-year comparison**
4. **Optimization insights** — AI-generated tips (e.g., "Your feed cost is ₹X/liter vs regional average ₹Y")
5. **What-if simulator** — "If milk price drops to ₹30, your break-even herd size is N"

---

## 6. Wallet (wallet-service)

### Service Details
- **Port:** 3004 (assumed)
- **Module system:** CommonJS (`require`)

### Wallet Model
```javascript
{
  farmerId: ObjectId,         // NOTE: controller uses userId — fix to farmerId
  balance: Number,
  escrowBalance: Number,      // locked during active cattle trades
  totalEarned: Number,
  totalSpent: Number,
  createdAt, updatedAt
}
```

### Transaction Model
```javascript
{
  farmerId: ObjectId,         // fix from userId
  type: enum["credit","debit","escrow_lock","escrow_release","escrow_refund"],
  amount: Number,
  description: String,
  referenceId: String,        // order ID, listing ID, etc.
  referenceType: enum["marketplace","membership","wallet_topup","helper_salary","expense"],
  status: enum["pending","completed","failed"],
  createdAt
}
```

### Wallet Operations
| Operation | Description |
|-----------|-------------|
| Add Money | Razorpay/UPI payment → credit wallet |
| Pay from Wallet | Debit for marketplace, membership, etc. |
| Escrow Lock | Lock buyer funds on cattle trade initiation |
| Escrow Release | Transfer to seller on successful delivery |
| Escrow Refund | Return to buyer on dispute/cancellation |

### Cattle Trade Escrow Flow
```
1. Buyer places order → escrow_lock(amount) on buyer wallet
2. Seller confirms & ships cattle
3. Buyer confirms receipt (or 7-day auto-confirm)
4. escrow_release(amount - platform_fee) → credit seller wallet
5. platform_fee credited to Godhan admin wallet
```

### Token Unlock (Phase 3)
- Buyer pays ₹1,000 token to unlock full cattle listing details (IoT data, seller contact)
- Token amount adjustable per listing tier

### Farm Health Score
Computed from wallet + cattle data for potential lender display:
```
Score (0–100) = (payment_history × 0.4) + (herd_health × 0.35) + (IoT_uptime × 0.25)
```

> **Bug to fix:** `walletController.js` uses `userId` but `wallet.js` model has `farmerId`. Standardize to `farmerId`.

---

## 7. Notifications (notification-service)

### Service Details
- **Port:** 3005 (assumed)
- **Module system:** CommonJS (`require`)

### Notification Model
```javascript
{
  farmerId: ObjectId,
  type: enum["alert","info","promo","system"],
  title: String,
  message: String,
  read: { type: Boolean, default: false },
  channel: enum["app","sms","whatsapp","push"],
  metadata: Object,           // extra context (e.g., cattleId for health alert)
  createdAt
}
```

### API Routes
| Method | Path | Description |
|--------|------|-------------|
| POST | `/notifications` | Create notification |
| GET | `/notifications` | Get farmer's notifications (paginated) |
| PUT | `/notifications/:id/read` | Mark as read |

### Trigger Events
| Event | Channel | Priority |
|-------|---------|----------|
| IoT health alert (fever, low HR) | Push + SMS | Critical |
| Heat detection (estrus) | Push + WhatsApp | High |
| Calving prediction (3 days) | Push + WhatsApp | High |
| Low battery (collar < 20%) | Push | Medium |
| Marketplace bid received | Push | Medium |
| Milk log reminder (daily 8am) | Push | Low |
| Membership expiry (7 days) | Push + SMS | Medium |
| Salary due reminder | Push | Medium |
| New helper application | Push | Low |

### Dispatch Mechanism (TO BE IMPLEMENTED)
Currently the service only stores notifications in MongoDB. Actual dispatch needs:
- **FCM** for push notifications (Android/iOS)
- **Twilio** for SMS
- **Twilio WhatsApp API** or **Gupshup** for WhatsApp
- Notification preferences per farmer (opt-in/opt-out per channel)

---

## 8. Referral Module

### How It Works
1. Farmer A gets unique `referralCode` on signup (e.g., `GODHAN-A3K9`)
2. Farmer A shares code with Farmer B
3. Farmer B signs up using referral code → `referredBy: FarmerA._id`
4. On Farmer B's **first paid action** (membership purchase, marketplace listing fee):
   - Farmer A earns **100 coins**
   - Farmer B earns **50 coins** (welcome bonus)
5. Ongoing: Farmer A earns 5% of platform fee on every Farmer B marketplace transaction (capped at ₹500/month per referral)

### Referral Leaderboard
- Top referrers (monthly) get **Godhan Ambassador** badge
- Ambassador perks: featured on marketplace, extra 10 coins/day

---

## 9. Membership & Coins

### Membership Tiers
| Feature | Free | Silver ₹499/yr | Gold ₹999/yr | Platinum ₹4,999/yr |
|---------|------|---------------|--------------|-------------------|
| Cattle registered | 5 | 15 | 50 | Unlimited |
| Marketplace listings | 2 | 5 | 20 | Unlimited |
| Marketplace commission | 5% | 3% | 2% | 1% |
| IoT collar discount | — | 5% | 10% | 20% |
| Helper management | Basic | Full | Full + Payroll | Full + Payroll + Analytics |
| Report access | Basic | Advanced | Advanced + Predictions | Full |
| Priority support | No | No | Yes | Dedicated |
| Coins multiplier | 1× | 1.5× | 2× | 3× |

### Coins System

#### Earning Coins
| Action | Coins Earned |
|--------|-------------|
| Signup | 20 |
| Daily login | 1 (max 30/month) |
| Log milk | 2/day |
| Register cattle | 10 |
| Record insemination | 5 |
| Record calving | 10 |
| Connect IoT collar | 50 |
| Complete profile | 15 |
| First marketplace listing | 25 |
| Rate a seller | 3 |
| Refer a friend (on their first purchase) | 100 |

#### Redeeming Coins
- 1 coin = ₹1 off on membership renewal
- Maximum 50% discount via coins
- Coins expire after 12 months of no activity
- Cannot be transferred or cashed out

---

## 10. Marketplace (marketplace-service)

### Service Details
- **Port:** 3003 (assumed)
- **Module system:** CommonJS (`require`)
- **Base path:** `/marketplace`

---

### 10A. Cattle Marketplace (Phase 3)

#### Listing Data Model
```javascript
{
  farmerId: ObjectId,
  type: enum["cattle_sale","cattle_rent","service"],
  title: String,
  description: String,
  price: Number,
  priceType: enum["fixed","negotiable","auction"],
  images: [String],
  status: enum["draft","active","sold","expired"],
  cattle: {
    cattleId: ObjectId,
    tag: String,
    breed: String,
    age: Number,
    weight: Number,
    grade: enum["S","A","B","C","D"],   // IoT-computed
    healthPassportId: String,
    lactation: Number,
    avgMilkDaily: Number,               // from 90-day log
    lastVetCheckDate: Date,
    vaccinations: [{ name, date }],
    iotDataMonths: Number               // months of IoT history
  },
  auction: {
    isAuction: Boolean,
    startPrice: Number,
    reservePrice: Number,
    endTime: Date,
    bids: [{ bidderId, amount, time }],
    currentHighestBid: Number,
    winner: ObjectId
  },
  tokenUnlockFee: { type: Number, default: 1000 },
  unlockedBy: [ObjectId],              // buyers who paid token
  location: { district, state, pincode },
  createdAt, updatedAt
}
```

#### Anti-Middleman Rules
1. Farmer must have ≥ 6 months of IoT collar data for the listed cattle
2. `isTrustedFarmer = true` required
3. Platform verifies cattle ownership via ear tag + IoT device binding
4. Listing auto-expires after 90 days
5. Same cattle cannot be relisted within 30 days of a failed sale

#### IoT Cattle Grading Algorithm
```
Grade Score (0–100) = 
  (health_vitals_score × 0.30) +
  (alert_history_score × 0.25) +
  (rumination_score × 0.20) +
  (activity_score × 0.15) +
  (reproductive_score × 0.10)

Grade S: 90–100
Grade A: 75–89
Grade B: 60–74
Grade C: 40–59
Grade D: Below 40
```

#### Digital Health Passport
- Generated after ≥ 90 days of IoT data
- Contains: cattle ID, breed, age, grade, health summary, alert history, vaccination records, last vet visit
- Cryptographically signed (HMAC-SHA256 with platform key)
- QR code on marketplace listing → scanned by buyer to verify authenticity
- Linked to blockchain audit trail (Phase 3+)

#### Marketplace API Routes
| Method | Path | Description |
|--------|------|-------------|
| POST | `/marketplace/listings` | Create listing |
| GET | `/marketplace/listings` | Browse listings (filter by breed, grade, district) |
| GET | `/marketplace/listings/:id` | View listing (public info only) |
| POST | `/marketplace/listings/:id/unlock` | Pay token to unlock full details |
| PUT | `/marketplace/listings/:id` | Edit listing |
| DELETE | `/marketplace/listings/:id` | Remove listing |
| POST | `/marketplace/listings/:id/bid` | Place auction bid |
| GET | `/marketplace/listings/:id/bids` | Get bid history |
| POST | `/marketplace/listings/:id/order` | Initiate purchase (triggers escrow) |

---

### 10B. Feed & Input Marketplace

#### Product Data Model
```javascript
{
  vendorId: ObjectId,         // hub or verified vendor
  name: String,
  category: enum["feed","medicine","equipment","supplement"],
  subCategory: String,        // "concentrate","green_fodder","vaccine","dewormer"...
  brand: String,
  description: String,
  price: Number,
  mrp: Number,
  unit: String,               // "kg","liter","pack","piece"
  stock: Number,
  images: [String],
  ratings: { average: Number, count: Number },
  reviews: [{ userId, rating, comment, date }],
  isVerified: Boolean,        // platform-verified input
  createdAt
}
```

#### Order Data Model
```javascript
{
  buyerId: ObjectId,
  items: [{ productId, quantity, price }],
  totalAmount: Number,
  deliveryAddress: { village, district, state, pincode },
  status: enum["pending","confirmed","shipped","delivered","cancelled"],
  paymentMethod: enum["wallet","cod","upi"],
  deliveryPartnerId: ObjectId,  // hub or delivery agent
  estimatedDelivery: Date,
  createdAt
}
```

#### Feed Marketplace API Routes
| Method | Path | Description |
|--------|------|-------------|
| POST | `/marketplace/products` | Add product (hub/vendor) |
| GET | `/marketplace/products` | Browse products |
| GET | `/marketplace/products/:id` | Product detail |
| PUT | `/marketplace/products/:id` | Update product |
| POST | `/marketplace/orders` | Place order |
| GET | `/marketplace/orders` | Buyer's orders |
| GET | `/marketplace/orders/:id` | Order status |

---

## 11. Helper Management (helper-service)

### Service Details
- **Port:** 3006 (assumed)
- **Module system:** ESM

### Helper Model
```javascript
{
  farmerId: ObjectId,         // employer
  name: String,
  phone: String,
  aadharNumber: String,
  address: String,
  doj: Date,                  // date of joining
  doe: Date,                  // date of exit (null if active)
  role: String,               // "milker","caretaker","supervisor","vet assistant"
  dailyWage: Number,
  attendance: [{
    date: Date,
    status: enum["present","absent","half_day","holiday"],
    hoursWorked: Number
  }],
  advances: [{
    date: Date,
    amount: Number,
    reason: String,
    repaid: Boolean
  }],
  salarySlips: [{
    month: String,            // "2026-04"
    daysWorked: Number,
    grossAmount: Number,
    advances: Number,
    netAmount: Number,
    paidDate: Date,
    paidVia: enum["cash","wallet","bank"]
  }],
  contractDocs: [String],     // document URLs
  experienceLetter: String,   // document URL
  isActive: Boolean,
  createdAt, updatedAt
}
```

### API Routes
| Method | Path | Description |
|--------|------|-------------|
| POST | `/helpers` | Add helper |
| GET | `/helpers` | List farm's helpers |
| GET | `/helpers/:id` | Helper detail |
| PUT | `/helpers/:id` | Update helper info |
| DELETE | `/helpers/:id` | Remove helper (sets doe, isActive=false) |
| POST | `/helpers/:id/attendance` | Mark attendance |
| GET | `/helpers/:id/attendance` | Get attendance log |
| POST | `/helpers/:id/salary` | Generate salary slip |
| GET | `/helpers/:id/salary` | Get salary slips |
| POST | `/helpers/:id/advance` | Record salary advance |
| GET | `/helpers/:id/contract` | Download contract |
| POST | `/helpers/:id/experience-letter` | Generate experience letter |

### Salary Calculation
```
Working Days = COUNT(attendance where status IN ["present","half_day"])
Half Days    = COUNT(attendance where status = "half_day") × 0.5
Gross        = (Working Days + Half Days) × dailyWage
Deductions   = SUM(advances where !repaid in this month)
Net Salary   = Gross - Deductions
```

### Day Laborer Flow (Phase 2)
- Farmers post day-work requests (e.g., "Need 2 helpers for harvesting on 15 May")
- Helpers in radius apply
- Farmer selects, records one-time attendance + payment
- Payment via wallet (instant settlement)

---

## 12. Reports & Analytics (report-service)

### Service Details
- **Port:** 3007 (assumed)
- **Module system:** CommonJS (`require`)

### Report Types

#### 1. Farmer Expenses Report
```
GET /reports/farmer/expenses?farmerId=X&from=DATE&to=DATE
→ category-wise breakdown, monthly trend, per-animal cost analysis
```

#### 2. Marketplace Summary
```
GET /reports/marketplace/summary?farmerId=X
→ listings created, sold, revenue, pending, avg sale price
```

#### 3. Wallet Summary
```
GET /reports/wallet/summary?farmerId=X
→ total credited, debited, escrow balance, transaction history
```

#### 4. Cattle Predictions Report
```
GET /reports/cattle/predictions?farmerId=X
→ calving predictions, heat detection events, health alerts summary
```

#### 5. Farmer Summary (Dashboard)
```
GET /reports/farmer/summary?farmerId=X
→ herd size, total milk this month, revenue, expenses, net P&L
```

#### 6. Report History
```
GET /reports/history?farmerId=X
→ previously generated PDF reports (stored in S3)
```

### Cron Jobs (Automated Reports)
| Frequency | Report | Recipient |
|-----------|--------|-----------|
| Daily 6am | Milk yield summary | Farmer push notification |
| Weekly Sunday | Weekly herd health | Farmer email |
| Monthly 1st | Monthly P&L + Salary summary | Farmer email + PDF |
| Monthly 1st | Platform analytics | Admin dashboard |

> **Bug:** Current cron jobs have hardcoded farmer IDs. Fix: fetch all active farmers from user-service API, then generate reports for each.

### Cross-Service Dependencies
```
report-service calls:
  → helper-service:  GET /helpers?farmerId=X (salary data)
  → marketplace-service: GET /marketplace/orders?farmerId=X
  → wallet-service:  GET /wallet/transactions?farmerId=X
  → cattle-service:  GET /cattle?farmerId=X (IoT-linked cattle)
  → cattle-iot-service: GET /iot/summary?farmerId=X (health scores)
```

### Report Model (TO CREATE)
```javascript
// File: report-service/src/models/Report.js
{
  farmerId: ObjectId,
  type: enum["expense","marketplace","wallet","cattle","summary","history"],
  period: { from: Date, to: Date },
  data: Object,               // report payload (JSON)
  pdfUrl: String,             // S3 URL if PDF generated
  generatedAt: Date,
  generatedBy: enum["cron","manual"]
}
```

> **Critical Bug:** `report-service/src/app.js` imports `require("./src/models/Report")` which doesn't exist. `report-service/src/models/Notification.js` is actually a Notification schema, not a Report schema. Create `Report.js` above.

---

## 13. Micro-Hubs & Delivery

### Hub Role
Hubs are verified local aggregators that:
1. Aggregate milk from multiple small farmers (daily pickup)
2. Sell quality inputs (feed, medicines) at farm-gate prices
3. Provide delivery of marketplace orders within 30km radius
4. Host IoT collar service centers (charging, replacement)

### Hub Data Model
```javascript
{
  userId: ObjectId,           // hub owner (role: "hub")
  hubName: String,
  location: { lat, lng, address, district, state, pincode },
  coverageRadius: Number,     // km
  services: [enum["milk_collection","input_retail","delivery","iot_service"]],
  isVerified: Boolean,
  operatingHours: String,
  milkCollectionRate: Number, // ₹/liter offered to farmers
  inventoryItems: [{ productId, stock, price }],
  deliveryAgents: [ObjectId],
  monthlyVolume: Number,      // liters collected
  createdAt
}
```

### Delivery Flow
```
1. Order placed on marketplace
2. Nearest hub in buyer's pincode assigned
3. Hub confirms stock availability
4. Delivery agent assigned (within hub's fleet)
5. OTP-based delivery confirmation (farmer verifies on app)
6. Payment released from escrow (or COD collected)
```

### Milk Collection Integration
- Farmer logs milk on app
- Hub collects daily (records pickup on hub app)
- Farmer sees collection history + payment timeline
- Hub pays farmers weekly via Godhan wallet

---

## 14. Dashboard (Home Screen)

### Farmer Dashboard Layout
```
┌─────────────────────────────────────┐
│  👋 Namaste, [Farmer Name]          │
│  [Farm Health Score: 78/100]        │
├─────────────────────────────────────┤
│  TODAY'S SNAPSHOT                   │
│  🐄 12 Cattle  |  🥛 45L  |  ₹2,340 │
├─────────────────────────────────────┤
│  ALERTS (2)                         │
│  🔴 Ganga: Fever detected           │
│  🟡 Lakshmi: Heat cycle in 2 days   │
├─────────────────────────────────────┤
│  QUICK ACTIONS                      │
│  [Log Milk] [Add Expense] [Notify]  │
├─────────────────────────────────────┤
│  MARKETPLACE                        │
│  [Browse Feed] [My Listings] [Bids] │
├─────────────────────────────────────┤
│  WALLET: ₹4,250  [Add] [Pay]        │
├─────────────────────────────────────┤
│  HELPERS (3 active)                 │
│  Salary due: Ram Kumar — ₹3,600     │
└─────────────────────────────────────┘
```

### Key Dashboard Metrics
- Herd size (active cattle count)
- Today's milk total (L) + revenue estimate (₹)
- Active IoT alerts count
- Wallet balance
- Upcoming events (calving, salary, membership renewal)
- Marketplace activity (active bids, listings)

---

## 15. Business Model

### Revenue Streams
| Stream | Model | Rate |
|--------|-------|------|
| IoT Collar Hardware | One-time purchase | ₹2,500–4,000/unit |
| SaaS Subscription | Per collar/month | ₹99–199/collar/month |
| Membership | Annual subscription | ₹499/₹999/₹4,999 |
| Marketplace Commission | % of transaction | 1–5% (tier-based) |
| Token Unlock Fee | Per cattle listing view | ₹1,000 |
| Featured Listing | Boost listing visibility | ₹299–999/week |
| Delivery Fee | Per order | ₹30–80 |
| Data Analytics (B2B) | Herd insights for dairy companies | Custom pricing |

### Revenue Projections (Year 1)
| Metric | Target |
|--------|--------|
| Active farmers | 5,000 |
| IoT collars deployed | 15,000 |
| Monthly SaaS revenue | ₹22.5L (15,000 × ₹150) |
| Annual membership revenue | ₹37.5L (5,000 × ₹750 avg) |
| Marketplace GMV | ₹5 Cr (5% commission = ₹25L) |
| **Total Annual Revenue** | **~₹1.6 Cr** |

### Seller Incentives
- Zero commission for first 3 listings (new seller onboarding)
- Top Seller badge for ≥ 10 successful transactions
- Priority placement for Platinum members

### On-Platform vs Off-Platform Value
| Factor | Off Platform | Godhan Platform |
|--------|-------------|----------------|
| Buyer trust | Low — verbal claim | Digital Health Passport |
| Price discovery | Local mandis only | Pan-India buyers |
| Payment safety | Cash — risk of fraud | Escrow wallet |
| Cattle history | None | 6-month IoT record |
| Negotiation | Middleman takes 20–40% | Direct P2P |

---

## 16. Implementation Priorities

### P0 — Fix Before Launch (Critical Bugs)
1. Fix `godhan-core` ESM/CJS mismatch — convert core to CJS or all services to ESM
2. Fix duplicate `role` field in `user.model.js`
3. Fix `walletController.js` using `userId` instead of `farmerId`
4. Fix `wallet-service` route imports (`fetchWallet`/`createTransaction` vs `addMoney`/`getBalance`)
5. Fix `transactionRoutes.js` broken `authMiddleware` import path
6. Create `report-service/src/models/Report.js` (currently missing)
7. Fix `report-service` cron — replace hardcoded farmer IDs with dynamic user fetch
8. Add actual notification dispatch (FCM/Twilio) to notification-service
9. Uncomment and wire up user routes (profile, membership, upload)

### P1 — Phase 1 MVP Features
1. Complete cattle CRUD + milk logs
2. Helper management (attendance + salary slip generation)
3. Expenses CRUD with category tagging
4. Basic wallet (top-up + payment)
5. Push notification delivery (FCM)
6. Basic reports (monthly summary, milk trend)

### P2 — Phase 2 Features
1. Membership tiers (Silver/Gold/Platinum)
2. Coins system (earn + redeem)
3. Feed & input marketplace
4. Referral system
5. Advanced reports + predictions (Python ML service integration)
6. Day laborer marketplace

### P3 — Phase 3 Features
1. IoT collar integration (MQTT ingestion into newCattle service)
2. Cattle grading algorithm
3. Digital Health Passport generation
4. Cattle P2P marketplace with escrow
5. Auction engine
6. Micro-hub management
7. Farm Health Score
8. Blockchain audit trail

---

## 17. App Screens Inventory

Based on HTML mockup files found in `claude-docs-for-device`:

### Authentication Screens
1. Splash / Onboarding
2. Register (Email / Mobile)
3. OTP Verification
4. Login
5. Forgot Password

### Main Tab Bar
6. Home Dashboard
7. Herd List
8. Marketplace
9. Alerts
10. Profile

### Cattle Screens
11. Add Cattle (multi-step form)
12. Cattle Detail (vitals, milk history, events)
13. Log Milk (morning/evening entry)
14. Record Insemination
15. Record Calving
16. Digital Health Passport View
17. IoT Collar Setup (BLE pairing flow)
18. Cattle Grade Detail (S/A/B/C/D breakdown)

### Marketplace Screens
19. Browse Listings (filter by breed, grade, district)
20. Listing Detail (public view)
21. Unlock Listing (token payment flow)
22. Create Listing
23. My Listings
24. Bid History
25. Order Checkout
26. Order Status / Tracking

### Helper Screens
27. Helper List
28. Add Helper
29. Attendance Marking
30. Salary Slip View / Generate
31. Experience Letter

### Finance Screens
32. Wallet Dashboard
33. Add Money (Razorpay)
34. Transaction History
35. Expenses List
36. Add Expense

### Report Screens
37. Monthly Summary
38. Cattle Health Report
39. Milk Production Trend
40. Marketplace Analytics

### Settings / Profile
41. Edit Profile
42. Membership & Coins
43. Referral Code Share
44. Notification Preferences
45. App Settings (language, dark mode)

---

## Appendix: Known Bugs Summary

| Service | Bug | Severity | Fix |
|---------|-----|----------|-----|
| godhan-core | ESM export, CJS consumers crash | Critical | Convert to CJS or migrate all to ESM |
| user-service | Duplicate `role` field overwrites first | High | Remove second role definition |
| wallet-service | Controller uses `userId`, model has `farmerId` | High | Standardize to `farmerId` |
| wallet-service | Route imports nonexistent exports | High | Fix import names to match controller |
| wallet-service | `transactionRoutes.js` broken authMiddleware path | High | Fix relative import path |
| report-service | Imports `./src/models/Report` that doesn't exist | Critical | Create Report.js model |
| report-service | Cron has hardcoded farmer IDs | Medium | Fetch from user-service |
| report-service | Controller uses `Report` variable never imported | Critical | Add require + fix imports |
| report-service | `models/Notification.js` is misnamed | Medium | Rename to Report.js with correct schema |
| notification-service | No FCM/SMS dispatch — DB store only | High | Add FCM + Twilio integration |
| user-service | All routes except auth commented out | High | Implement and mount |
| marketplace-service | No token unlock, Health Passport, escrow flows | Medium | Phase 3 implementation |

---

*Document generated from: SERVICE_ANALYSIS_REPORT.md + DOCS_ANALYSIS_REPORT.md + IOT_DEVICE_DESIGN.md*
*IoT device architecture: See IOT_DEVICE_DESIGN.md*
