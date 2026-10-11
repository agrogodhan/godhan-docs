# Godhan Dairy Shop: Look-and-Feel and Checkout Redesign

**Status:** proposal with most open questions answered (2026-10-11); cash on delivery, the courier and four setup items are open (section 10). No code has been changed.
**Companion files:** `DAIRY_SHOP_UX_MOCKUP.html` (clickable phone mockup of every screen below) and `DAIRY_SHOP_LISTING_SPEC.md` (catalog, GST, delivery fee and phase decisions this document builds on).

---

## 1. Purpose, scope and decisions

Phase 1 (admin catalog) and Phase 2 (app discovery: paging, filters, sort, richer card and detail) are built and tested on a phone. The shop now has good product data, but it still *looks* like a basic list and the **path from cart to a placed order is its weakest part**. This document studies how the Flipkart and Myntra apps and the published checkout research handle look-and-feel and checkout, compares that with what Godhan does today, and proposes a redesign with a build order.

**Decisions already taken**

| Decision | Source |
|---|---|
| Godhan is the only seller; OTC products only; four categories plus OTC health | Listing spec |
| GST rate is configurable; delivery fee is a flat fee with a free-delivery threshold, both configurable | Listing spec |
| No returns in this phase; cash on delivery is a per-product flag (`codAvailable`), but **COD is not offered for now** (see below) | Listing spec; user, discussion |
| **Add UPI / card online payment next to the wallet** | User |
| **Razorpay** is the payment gateway to plan around | User, discussion |
| Free delivery is judged on the amount **after** the coupon discount | User, discussion (matches the listing spec proposal) |
| **Cash on delivery is dropped for now** and kept as an open item (cap, pincode and cash-collection rules to be decided later) | User, discussion |
| Order status messages go by **push + SMS** | User, discussion |
| Delivery by a **courier aggregator** with a served-pincode list in Shop Settings; the **courier itself is still to be chosen** | User, discussion |
| Delivery fee **₹49** and free delivery above **₹999** (as entered in Shop Settings for now) | User, discussion |
| First served pincode: **231001** (Mirzapur) | User, discussion |
| SMS provider: **2Factor**, which `user-service` already uses for login and signup OTPs (`otp.service.js`, `config/twoFactor.js`) | User, discussion; confirmed in the code |
| **Receipt now, GST invoice after accountant sign-off** | User, discussion |
| **English + Hindi** toggle for the shop and checkout screens | User, discussion |
| The cart lives **on the device only** (no server sync) | User, discussion |
| Deliver a markdown document **and** a clickable HTML mockup | User, this round |

**Out of scope for this proposal:** multi-seller, returns, prescription products, live shopping and video commerce, regional-language UI (listed as a later item), image search.

---

## 2. Research findings (with honest limits)

Flipkart and Myntra block automated fetching of their product and checkout pages, and Amazon.in was not retrievable. Most of what is public comes from case studies and third-party write-ups, so every claim below is labelled:

- **Primary**: published by the company or by the research body itself.
- **Secondary**: a third party describing the product.
- **Concept**: a designer's portfolio or redesign proposal, not the company's own design.
- **Vendor**: a payment vendor's customer story (marketing, outcomes unverified).

### 2.1 Flipkart app

| Finding | Label | Source |
|---|---|---|
| One bottom bar replaced a double-drawer nav. The **cart sits bottom-right** where a thumb reaches it, because users treat Add to Cart as a shortlist. Categories took the centre slot and the burger menu was dropped. | Secondary (redesign write-up, 2022) | [thehardcopy.co](https://thehardcopy.co/case-study-flipkart-product-redesign/) |
| **Filters became clickable tags** personalised by browsing history, replacing dropdowns. | Secondary | same |
| Image search, Hindi and English **voice search**, and a vernacular interface in 11 languages; 95% of users who start in a local language stay in it. | Secondary | same |
| **Product ratings are shown inside the cart** to help the final buying decision; this came out of A/B tests. | Secondary | same |
| Research split: first-time users need **trust and familiar patterns**; seasoned users want discovery. Novices often cannot name a product they saw, and misspell. A feature ships only with a 95% positive A/B result. | Secondary | same |
| Order tracking is a **vertical timeline** (Ordered and Approved, Packed, Shipped, Delivery) with the current stage marked; tapping a stage shows details and the expected date. | Secondary, from a search snippet of a Flipkart Stories page; the page itself returned "not found" when fetched | search result for stories.flipkart.com, plus [WareIQ](https://wareiq.com/resources/blogs/flipkart-logistics-tracking/) |
| SMS and email at order placement and at each status change; the customer is told if the delivery date moves. "Out for delivery" appears in some descriptions and may be a sub-state of Shipped. | Secondary | WareIQ |
| Card payments: OTP auto-read and in-app device authentication reduced two-factor friction and abandonment. | Vendor | [Juspay](https://juspay.io/customer-stories/flipkart) |
| A student redesign shows **both** "Add to Cart" and "Buy Now" on the product page and a small confirmation after adding to cart. | Concept | [uxcel](https://app.uxcel.com/showcase/flipkart-checkout-case-study-737) (page text not retrievable; the claim is from a search summary) |

### 2.2 Myntra app

Public material on Myntra's own checkout steps is thin; that is stated as a gap, not filled in.

| Finding | Label | Source |
|---|---|---|
| Personalised home feed and flash offers; an in-app content hub; sale events drive traffic spikes. | Secondary | [youngurbanproject](https://youngurbanproject.com/myntra-case-study/) |
| A **wishlist feeds personalised discounts**; cart reminders by email and SMS; time-limited offers; app-only offers and coupon gamification (scratch cards, spin the wheel). | Secondary | same |
| Easy returns and Try & Buy are described as a key part of the experience. | Secondary | same |
| Redesign concept: simplified bag-to-checkout, **transparent price details and offers shown in the bag**, accordion sections for product detail, similar products on the product page. | Concept | [fueler](https://fueler.io/sharath_mahadeva/myntra-app-redesign-uxui-design-concept) |
| Flow: add an item with size and quantity, open the bag from the top-right icon, "Place Order", then log in or create an account. Coupons are applied on the checkout page. Free-shipping thresholds quoted by coupon sites range from about 799 to 1199 rupees and conflict, so **no figure is adopted**. | Secondary (coupon sites) | e.g. [zoutons](https://zoutons.com/news/myntra-free-delivery-coupon) |
| Not found: Myntra's address step, payment step and order tracking screens. | Gap | n/a |

### 2.3 Checkout research (applies to any shop)

| Guideline | Source |
|---|---|
| Keep the flow **linear**; never show the same page twice. The progress indicator must match the real steps; completed steps are clickable; button labels are specific ("Continue to Payment"). | [Baymard](https://baymard.com/blog/checkout-flow-ux-optimization) (primary) |
| **Guest checkout** as the most prominent option; 19% of surveyed US adults abandoned an order to avoid creating an account. (Godhan users are always signed in, so this becomes: never ask for a second login or account at checkout.) | Baymard |
| Show **shipping, tax and fees in the cart**, not at the last step: 39% of users leave over unexpected extra charges, 14% could not see total cost upfront. The review step only summarises and must not add new fees. | Baymard |
| Review step: **Edit links**, order summary visible throughout, "Place Order" the most prominent control. | Baymard |
| Address: single full-name field, address lookup and autofill, persistent labels above fields, mark required and optional. Payment: preselect the most popular method, show only fields for the chosen method, keep entered data when switching, offer a wallet or UPI option. | Baymard, [web.dev](https://web.dev/articles/payment-and-address-form-best-practices) |
| Errors: inline and specific, validate after a field is finished, **never clear entered data**, catch payment problems at the payment step. | Baymard, web.dev |
| Mobile: numeric keyboard for pincode and card, email keyboard for email, disable autocorrect for names and addresses, keep the main button visible without scrolling. | Baymard, web.dev |
| **Disable the submit button after a tap** to prevent duplicate orders; remove navigation and promotions from checkout to reduce exit points. | web.dev |
| Average cart abandonment is about 70%; large shops gain up to 35% conversion from checkout redesign. | Baymard |
| Limiting checkout to about three steps is **one vendor's rule of thumb**, not a Baymard finding. | [wisernotify](https://www.wisernotify.com/blog/mobile-checkout-optimization-tips/) (secondary) |

### 2.4 What this means for Godhan

1. **Trust is the first job.** Flipkart's research says first-time buyers need reassurance. For a farmer buying feed or an OTC tonic that means visible price breakdown, "Godhan Verified", vet-reviewed content, delivery estimate and a clear order status afterwards.
2. **No surprises at the end.** The delivery fee, GST note and discount must appear in the cart, not for the first time at "pay".
3. **Fewer steps, more help.** Saved addresses, pincode lookup and a visible wallet balance remove the typing and the dead ends.
4. **After purchase matters as much as before.** Order id, status timeline, notifications and cancel are what stop support calls.

---

## 3. Where the Godhan shop stands today

Mapped from `CartScreen.kt`, `CheckoutScreen.kt`, `MyOrdersScreen.kt`, `DairyShopViewModel.kt`, `marketplace.service.js` (`createOrder`) and `order.model.js`.

### 3.1 Current flow

```
Shop list ──► Product ──► Cart ──► Checkout (one long page) ──► "Order Placed!" ──► Done ──► shop list
                                      address, coins, offer code, summary          (no order id, no link to orders)
Orders tab: list of cards with a status badge (no detail, no timeline)
```

### 3.2 Gaps

| Area | Today | Impact |
|---|---|---|
| Cart price | Lines and a single Total. No delivery fee, tax or discount row. | The farmer cannot see what the total is made of. Fee and GST are coming (listing spec Phase 3) and need a place to live. |
| Cart behaviour | Held in memory only; lost when the app is killed. Product snapshot goes stale. `+` silently does nothing at max stock. No per-line delete. | Lost carts, confusing taps. |
| Price and stock changes | The server reprices at checkout; the screen never shows or warns about a changed price. A stock failure says "Product <id> is out of stock". | Silent price differences; unreadable errors. |
| Address | Four free-text fields (village, district, state, pincode), retyped every time; no pincode check, no phone, no landmark. `lat` and `lng` exist but are never collected. | Slowest part of the flow, and a source of bad deliveries. |
| Coins | One-coin stepper; no rupee label; the screen allows up to the full total while the server caps coins at a percentage. | The "You'll pay" line can differ from the real charge. |
| Offers | Typed by hand; no list of eligible offers or minimum-spend hint; an applied offer is silently dropped if the cart changes. | Offers are hard to find and fail quietly. |
| Payment | **Wallet only.** The order schema allows `upi` and `card` but nothing handles them. No COD, although products carry `codAvailable`. Insufficient balance shows a red error with no balance and no "Add money". | A farmer with an empty wallet is stuck. |
| Confirmation | "Order Placed!", paid split and savings. No order id, items, address or delivery estimate; its only button goes back to the shop. | No reassurance; no way to follow the order. |
| Orders | A list with a status badge. No detail screen, timeline, cancel, invoice or reorder. Statuses (`pending`, `paid`, `delivered`, `cancelled`) are set by an admin only. | Support calls. |
| Backend safety | Wallet charge, stock decrement and order save are not one atomic step; there is no refund path on cancel; no idempotency key. | **Must be fixed before any online payment**, or a failure can charge a farmer without an order. |
| Accessibility | Stepper buttons have no content description; English only. | Screen-reader and local-language gaps. |

---

## 4. Look-and-feel redesign

What to borrow, adapted to farmers and dairy products. The mockup shows each of these.

### 4.1 Shop home
- **Search** with recent searches and suggestions (name, brand, tags already searchable).
- **Category tiles with icons** (Feed, Supplements, OTC health, Equipment, Calf care) instead of only chips; the chips stay as the quick filter on the list.
- **Offers for you** strip fed by `/offers/active`, with the code and a one-tap "Apply at checkout".
- **Buy again** and **Recently viewed** rows (farmers reorder the same feed and mineral mix).
- **Trust row:** Godhan Verified, vet-reviewed, delivery in N days. (A "Cash on delivery" chip returns when COD is launched; see section 4.5.)

### 4.2 Listing (builds on Phase 2)
- Keep the sticky sort and filter bar and the filter sheet.
- Cards: **pack size and price per kg**, delivery-in-N-days, "Only N left", offer badge, wishlist heart (all fields already exist).
- **Skeleton loaders** instead of a spinner; pull to refresh (exists).
- Later: filter chips personalised by history (Flipkart finding), kept off the first release.

### 4.3 Product page
- **Sticky bottom bar:** Add to Cart and Buy Now (Buy Now jumps straight to the address step).
- Delivery estimate with a **pincode check** (listing spec Phase 4) and the delivery-fee rule line.
- **Offers block** listing coupons that apply to this product.
- Tap-to-zoom gallery; "Other sizes" and "Similar products" (Phase 3 and 4 of the listing spec); rating breakdown.

### 4.4 Visual system
- Tokens already in the app theme: green `#2E7D32`, deep green, amber, red, neutrals. Use one elevation and radius scale (12 dp cards, 8 dp inputs) and an 8 dp spacing grid.
- Standard patterns for **empty, loading and error** states (error always offers "Try again", as in the admin).
- Micro-feedback: a short animation and haptic on Add to Cart, a toast "Added to cart · View cart".
- **Accessibility:** content descriptions on every icon button, 48 dp touch targets, contrast of 4.5:1 for body text, text that scales.

### 4.5 Fix now: the app still shows a "Cash on delivery" chip
The Phase 2 product page shows a **"Cash on delivery" chip whenever a product has `codAvailable` set** (it defaults to true), but checkout is wallet-only. Until COD is launched, either hide that chip in the app or switch `codAvailable` off on every product. It is a one-line change and belongs in Phase A.

---

## 5. Checkout redesign (the core of this document)

### 5.1 The new flow

```
Cart ──► Address ──► Payment ──► Review ──► Confirmation ──► Order detail and tracking
 (price details,   (saved cards,  (wallet, UPI,  (summary, Edit    (id, items, ETA,        (timeline, cancel,
  offers, fee)      pincode)       card)          links, Place)     Track order)            reorder)
```

Rules taken from the research: linear, no repeated page, a **"Step 2 of 3"** header that matches the real steps (Address, Payment, Review), completed steps tappable, no promotions inside checkout, specific button labels, and the order summary always one tap away.

### 5.2 Cart

```
┌──────────────────────────────────────┐
│ ‹  Cart (2)                    Clear │
├──────────────────────────────────────┤
│ [img] Godhan Test Dairy Feed 25 kg   │
│       Godhan Test · 25 kg bag        │
│       ₹1150  ₹1500  23% off          │
│       ★ 4.2 (18)       [–] 1 [+]  🗑 │
│                      Move to wishlist│
├──────────────────────────────────────┤
│ ⚠ Price of "Mineral Mix" changed:    │
│   ₹259 → ₹249        [Got it]        │
├──────────────────────────────────────┤
│ 🏷 Offers (2 available)           ›  │
├──────────────────────────────────────┤
│ Price details                        │
│ Items (2)                    ₹1,399  │
│ Discount (TEN)                 –₹140 │
│ Delivery               Free ✔        │
│ ▓▓▓▓▓▓▓▓▓▓ Free delivery above ₹999  │
│ GST included in prices               │
│ You pay                      ₹1,259  │
├──────────────────────────────────────┤
│ [ Continue to Address     ₹1,259 ]   │
└──────────────────────────────────────┘
```

- **Price-details card** (items, discount, delivery fee or "Free delivery above ₹X" progress, GST included note, you pay). The fee and threshold come from the existing shop settings (`SHOP_DELIVERY_FLAT_FEE`, `SHOP_FREE_DELIVERY_ABOVE`), and the threshold is compared with the amount **after** the coupon discount (the progress bar shows how much more to add); until Phase 3 of the listing spec lands, the card shows the rows it can (items, discount) and hides the rest.
- **Per-line delete**, "Move to wishlist", and a message when `+` hits the stock limit ("Only 4 in stock").
- **Rating shown per line** (Flipkart A/B finding).
- **Offers sheet** lists eligible coupons with a minimum-spend hint ("Add ₹140 more to use TEN").
- **Price or stock changed** banner before the farmer reaches payment, from a quick re-check of the cart.
- Cart is **saved on the device** and restored after the app restarts (decided: no server sync for now, so it does not follow a farmer to another phone).

### 5.3 Address

```
┌──────────────────────────────────────┐
│ ‹  Delivery address        Step 1 of 3│
├──────────────────────────────────────┤
│ ◉ Home · Shashank Singh              │
│   Village Kuri, Mirzapur, UP 231001  │
│   📞 98xxxxxx12            [Edit]    │
│ ○ Dairy farm gate                    │
│   ...                                │
│ + Add new address                    │
├──────────────────────────────────────┤
│ New address                          │
│ Full name   [                  ]     │
│ Phone       [          ]  (numeric)  │
│ Pincode     [ 231001 ]  ✔ Mirzapur,  │
│                          Uttar Pradesh│
│ Village / area [                ]    │
│ Landmark (optional) [           ]    │
│ ☐ Save as default                    │
├──────────────────────────────────────┤
│ [ Continue to Payment ]              │
└──────────────────────────────────────┘
```

- **Saved address cards** (default, add, edit, delete); the last used address is preselected, so a repeat order is two taps.
- **Pincode lookup** fills district and state; a pincode that is not in the **served-pincode list** (kept in Shop Settings) shows "We do not deliver here yet" at this step, not after payment.
- One name field, phone number and landmark; persistent labels; numeric keyboard for phone and pincode; inline errors that never clear what was typed.
- Optional "use my location" pin using the existing `lat` and `lng` fields.

### 5.4 Payment

```
┌──────────────────────────────────────┐
│ ‹  Payment                 Step 2 of 3│
├──────────────────────────────────────┤
│ ◉ Godhan Wallet            ₹2,450    │
│     Balance is enough       [Add money]│
│ ○ UPI    (GPay, PhonePe, Paytm…)     │
│ ○ Card   (credit or debit)           │
├──────────────────────────────────────┤
│ ☑ Use 120 coins (–₹120)  [Use max]   │
│   Up to 20% of the amount can be paid│
│   with coins (example cap)           │
├──────────────────────────────────────┤
│ Pay from wallet    ₹1,139            │
│ Coins              –₹120             │
├──────────────────────────────────────┤
│ [ Review order ]                     │
└──────────────────────────────────────┘
```

- Order of methods: **Godhan Wallet** (shows the balance, "Add money" when short), **UPI**, **Card**. **Cash on delivery is not offered for now** (open item, section 10); when it returns it needs a cap, a served-pincode rule and a cash-collection process, and it would sit last in this list.
- The method fields appear only for the chosen method; switching keeps what was typed (Baymard).
- **Coins as a toggle** ("Use N coins (₹N)") with a **Use max** option and the server cap applied on the screen, so the split shown is the split charged.
- A wallet shortfall offers "Add money" or "Pay the rest with UPI".
- A sticky main button stays visible without scrolling.

### 5.5 Review

- Summary only: items, address (Edit), payment method (Edit), price details. **No new fees appear here.**
- **Place order** is the most prominent control; it is disabled after one tap (double-tap protection) and the request carries an **idempotency key** so a retry cannot create a second order.
- One short line of policy: "No returns · Cancel before shipping" (from the product flags).

### 5.6 Confirmation

```
        ✔  Order placed
   Order #GD-20261011-0042
   Delivery in about 3 days  ·  Wed 14 Oct
 Godhan Test Dairy Feed 25 kg × 1   ₹1,150
 Mineral Mix 5 kg × 1               ₹249
 Deliver to: Village Kuri, Mirzapur 231001
 Paid  Wallet ₹1,139 + 120 coins     You saved ₹540
 [ Track order ]   [ Continue shopping ]
```

- Order id, items, address, expected delivery, how it was paid (wallet, coins, online) and savings.
- **Track order** is the main button; Continue shopping is secondary. A **receipt** (items, price details, "GST included") is shown now; the downloadable GST invoice link appears only after the accountant approves the layout (listing spec Phase 3).

### 5.7 Order detail and tracking

```
 Order #GD-20261011-0042          Placed 11 Oct
 ●─ Placed            11 Oct 9:12
 │
 ●─ Packed            11 Oct 6:40 pm
 │
 ◯─ Shipped           expected 12 Oct
 │
 ◯─ Out for delivery
 │
 ◯─ Delivered         expected 14 Oct
 [ Cancel order ]   [ Reorder ]   [ Invoice ]   [ Help ]
```

- A vertical timeline (Placed, Packed, Shipped, Out for delivery, Delivered, or Cancelled); tap a step for its date and note, as in the Flipkart pattern.
- **Cancel** until shipped (the `cancellableUntilShipped` flag exists); a refund goes back to the original method.
- **Reorder** puts the same items in the cart.
- **Notifications** on every status change by **push and SMS** (decided; WhatsApp is not planned for now). The notification service already exists in the marketplace service for push; SMS goes through **2Factor**, which `user-service` already uses for OTP messages.
- **Delivery** is by a courier aggregator; the courier's status updates feed the timeline.
- The orders list becomes tappable and shows the item thumbnail, status line and total.

### 5.8 Failure paths (each needs a defined screen or message)

| Situation | What the farmer sees |
|---|---|
| Wallet balance too low | Balance, shortfall, "Add money" or "Pay the rest with UPI" |
| Online payment failed or cancelled | "Payment didn't go through. Your cart is safe." with Try again and Choose another method |
| Payment pending (UPI timeout) | "We're confirming your payment" with Check status; the order only becomes paid on the server's signed confirmation |
| Item went out of stock after the cart | Item name, "Only N left" or "Sold out", with Remove or Change quantity |
| Price changed | Banner showing old and new price before payment |
| Offer no longer valid | Message with the reason (expired, minimum not met); total updates |
| No network | "No connection. Your cart is saved." with Retry |
| App closed mid-checkout | Cart and last address restored on reopening |

---

## 6. UPI and card online payment (Razorpay)

**Razorpay is the chosen gateway.** The steps below follow the standard gateway pattern (create an order on the server, pay in the provider's sheet, confirm from a signed webhook), so they also hold if the provider changes. **A Razorpay merchant account with business KYC is needed before build**; development and testing use Razorpay's test mode first. Razorpay's current fees, supported payment methods and SDK details should be re-checked on its own documentation when the phase starts; they were not researched here.

1. **Server decides the amount.** The app asks the server to create a payment intent for the cart; the server prices the lines (with the offer price and the delivery fee), applies the offer and coins, and returns an amount. The client's price is never trusted (this is already how `createOrder` works).
2. **Client pays** through the provider's native sheet (UPI intent or card form). Card details never touch Godhan servers, which keeps PCI scope off Godhan.
3. **Server confirms** from a **signed webhook** (and a status check if the webhook is late). The order moves `pending` to `paid` only then; stock is reserved at intent creation and released if payment fails or expires.
4. **Refunds** on cancel go back through the provider; wallet payments refund to the wallet; coins are re-credited.
5. **Wallet top-up** reuses the same flow (so "Add money" from checkout lands back on the payment step).
6. **Reconciliation:** a daily job lists intents that are paid at the provider but not on the server, and the reverse.
7. **Test mode first**, with the provider's test cards and UPI ids, as in the existing Phase 1 and Phase 2 test approach.
8. Flipkart-style card friction reducers (OTP auto-read, device authentication) come from the provider's SDK, not custom work (Juspay vendor note above).

**Prerequisite fixes (existing code):** make charge, stock decrement and order save a single safe unit with rollback, add the cancel-and-refund path and the idempotency key. Without these, adding online payment multiplies the "charged without an order" risk found in section 3.

---

## 7. API and data changes (summary)

| Change | Why |
|---|---|
| `GET/POST/PUT/DELETE /address` (saved addresses per user), default flag | Saved addresses and one-tap repeat orders |
| `GET /pincode/:code` (district, state, serviceable from the served-pincode list) | Pincode lookup and unserved-area check |
| `POST /order/preview` returns `deliveryFee`, `gstTotal`, per-line tax split, eligible offers and price-changed lines | Cart price details and offers sheet; uses existing shop settings |
| `GET /offers/for-cart` | Eligible coupons with minimum-spend hints |
| `GET /order/:id`, order `statusHistory[]` with timestamps and notes | Order detail and timeline |
| `POST /order/:id/cancel` with refund | Cancel before shipping |
| `POST /payment/intent`, `POST /payment/webhook`, `GET /payment/:id/status` | UPI and card |
| Idempotency key header on `POST /order/checkout` | Duplicate-order protection |
| Atomic charge, stock and order save with rollback | Backend safety |
| Order fields `paymentMethod` (`wallet`, `upi`, `card`; `cod` is reserved for later), `paymentRef`, `invoiceNumber` (listing spec) | Reporting and invoices |
| Shop Settings addition: `SHOP_SERVED_PINCODES` (list; starts with `231001`). The delivery-fee fields already exist and are set to ₹49 and ₹999 | The pincode check |
| Order status SMS through **2Factor**: reuse the existing account and call pattern from `user-service` (`otp.service.js` calls `https://2factor.in/API/V1/<api key>/SMS/...`); marketplace-service needs its own `TWOFACTOR_API_KEY` setting (or a small shared helper in `godhan-core`) and a template per status message | Order status SMS |
| Courier integration (aggregator API or webhook) writing into `statusHistory[]` | Real shipping status in the timeline |

Existing pieces reused: wishlist/favourites, offers and redemptions, the notification service, shop settings, `codAvailable` and `cancellableUntilShipped` product flags.

---

## 8. Phased backlog

| Phase | Scope | Depends on |
|---|---|---|
| **A. Quick wins (app only, about 1 to 1.5 weeks)** | Cart price-details card (rows that exist today), per-line delete, stock-limit message, cart saved on device, coins toggle with rupee label and the real cap, last address remembered, confirmation with order id, items and **Track order**, tappable orders list with a detail screen, accessibility fixes, skeleton loaders, sticky Add to Cart / Buy Now on the product page, **move shop and checkout strings into resource files so Hindi can be added, hide the "Cash on delivery" chip until COD exists (4.5)** | Nothing new on the server except `GET /order/:id` |
| **B. Checkout v2 (app and API, about 3 to 4 weeks)** | Three-step flow with progress, saved addresses and pincode lookup, delivery fee and GST rows (listing spec Phase 3), order status history and timeline, cancel and refund, idempotency key, atomic charge and stock, price-changed and out-of-stock handling, **served-pincode list in Shop Settings, courier integration (once chosen), push + SMS (2Factor) status messages, Hindi translation of the shop and checkout screens, receipt** | Phase A, listing spec Phase 3 settings applied at checkout, accountant sign-off on invoice and tax split |
| **C. Online payment (about 3 to 4 weeks plus onboarding)** | UPI and card through **Razorpay**, wallet top-up inline, webhook, reconciliation | Phase B safety fixes, Razorpay merchant account and KYC |
| **D. Delight (ongoing)** | Offers for you, buy again, recently viewed, similar products and other sizes, pincode check on the product page, personalised filter chips | Traffic and data |

Estimates are rough and assume the existing codebase; they should be re-sized when a phase is picked up.

---

## 9. How to know it worked

- **Checkout completion rate** (started checkout to placed order) and **cart-to-order conversion**.
- **Time from cart to order** for a repeat buyer (target: under a minute with a saved address).
- **Payment failure and retry rate** by method.
- **Support contacts about orders** (where is my order, I was charged twice).
- **Share of orders using each method.**
- Roll out each phase to a small group first and compare; Flipkart's "95% positive" A/B bar is a reference for how strict a large company is, not a target for Godhan.

---

## 10. Decisions and open items

### Resolved (2026-10-11)

| # | Question | Decision | Effect on this document |
|---|---|---|---|
| 1 | Payment provider | **Razorpay** | Sections 6 and 8 (Phase C); needs merchant account and KYC |
| 2 | Free-delivery threshold basis | **After** the coupon discount | Cart price details (5.2); preview and checkout compute it server-side |
| 3 | Delivery fee and threshold amounts | **₹49** fee, free above **₹999**, entered in Shop Settings for now | Cart price details (5.2) |
| 4 | Who ships, and where | **Courier aggregator** with a **served-pincode list** in Shop Settings; first served pincode **231001** | Address step (5.3); courier status feeds the timeline (5.7) |
| 5 | GST invoice | **Receipt now**, downloadable invoice **after accountant sign-off** | Confirmation and order detail (5.6, 5.7) |
| 6 | Languages | **English + Hindi** toggle for the shop and checkout screens; product content stays English for now | Phase A prepares strings, Phase B translates |
| 7 | Notifications | **Push + SMS through 2Factor**, the account already used for OTPs (no WhatsApp for now) | Sections 5.7 and 7 |
| 8 | Cart sync | **Device only** | Section 5.2; no cart endpoints |
| 9 | Cash on delivery | **Dropped for now**, kept as an open item (below) | Payment screen (5.4); the app's COD chip is hidden (4.5) |

### Open items

| # | Item | Notes | Status |
|---|---|---|---|
| A | **Cash on delivery** | If it comes back: a cap amount (₹3,000 was the proposal), served-pincode rule, who collects the cash from the courier and how it is reconciled, and which products allow it. Until then the app must not advertise it (4.5). | Open, decide later |
| B | **Courier aggregator** | Shiprocket, Delhivery or similar: charges, API, status updates feeding the timeline, and which pincodes it can serve beyond 231001. | Open, decide later |
| C | **Razorpay onboarding** | Who owns the merchant account and KYC, and which bank account receives settlements. Also confirm fees and payment methods on Razorpay's own documentation. | For discussion |
| D | **Accountant sign-off** | GST invoice layout, numbering and the CGST/SGST vs IGST split (carried over from the listing spec). | For discussion |
| E | **Hindi wording review** | Who checks the Hindi text so farm terms read naturally. | For discussion |
| F | **2Factor for order messages** | The account, API key and call pattern already exist for login and signup OTPs, so no new provider setup. What is still needed: (1) a message template for each order status (placed, packed, shipped, out for delivery, delivered, cancelled), registered and approved the way the OTP template was (the OTP template name is held in `TWOFACTOR_SMS_TEMPLATE`; an OTP template cannot carry order text); (2) the cost per message and the account balance for the extra volume; (3) the API key made available to the marketplace service. Whether 2Factor's custom-OTP endpoint can also send these non-OTP messages, or a different endpoint is needed, was **not verified** and should be confirmed with 2Factor's documentation or support. | To do, small |

---

## 11. Sources and limits

**Primary**
- Baymard Institute, [The Checkout UX Guide](https://baymard.com/blog/checkout-flow-ux-optimization)
- Google web.dev, [Payment and address form best practices](https://web.dev/articles/payment-and-address-form-best-practices)
- Amazon Pay, [mobile checkout post built with Baymard](https://pay.amazon.com/blog/how-amazon-pay-facilitates-a-seamless-mobile-checkout-experience) (guest checkout most prominent; hide password fields until Sign In is chosen)

**Secondary**
- [The Hard Copy, Flipkart app redesign write-up](https://thehardcopy.co/case-study-flipkart-product-redesign/) (navigation, filters as tags, vernacular, ratings in cart, user research)
- [WareIQ, Flipkart logistics tracking](https://wareiq.com/resources/blogs/flipkart-logistics-tracking/) (notification and tracking stages)
- [Young Urban Project, Myntra case study](https://youngurbanproject.com/myntra-case-study/) (personalisation, wishlist, offers, returns)
- [Zoutons, Myntra free delivery](https://zoutons.com/news/myntra-free-delivery-coupon) (bag to Place Order flow; thresholds conflict across coupon sites and are not used)
- [Wisernotify, mobile checkout tips](https://www.wisernotify.com/blog/mobile-checkout-optimization-tips/) (three-step rule of thumb, one vendor's view)

**Concept projects**
- [Fueler, Myntra redesign concept](https://fueler.io/sharath_mahadeva/myntra-app-redesign-uxui-design-concept), [uxcel, Flipkart checkout case study](https://app.uxcel.com/showcase/flipkart-checkout-case-study-737) (page text could not be retrieved; claim is from a search summary)

**Vendor**
- [Juspay, Flipkart story](https://juspay.io/customer-stories/flipkart) and [Hyperswitch, Flipkart story](https://hyperswitch.io/case-studies/flipkart) (card-payment friction; marketing, outcomes unverified)

**Could not be verified, so not asserted**
- Flipkart's and Myntra's own current product-page and checkout screens (blocked or not retrievable).
- Myntra's address, payment and tracking screens.
- Flipkart's cancel-order flow.
- Exact free-delivery thresholds at Myntra or Flipkart.
- The Flipkart Stories tracking page itself (it returned "not found"); the four-stage timeline comes from a search summary of it and WareIQ.

**Internal**
- `godhan-app/shared/.../ui/screens/market/dairy/` (`CartScreen.kt`, `CheckoutScreen.kt`, `MyOrdersScreen.kt`, `DairyShopViewModel.kt`), `marketplace-service/services/marketplace.service.js` (`createOrder`, `previewOrderDiscount`), `models/order.model.js`, `DAIRY_SHOP_LISTING_SPEC.md`.
