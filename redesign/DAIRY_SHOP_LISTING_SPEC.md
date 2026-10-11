# Dairy Shop — Product Listing Specification

Status: **draft for review** · Written 2026-10-11 · English only · No code has been changed for this document.

## 1. Purpose and scope

The Dairy Shop (marketplace-service `Product`, admin `Products` page, app `ui/screens/market/dairy/`) works end to end
(browse, cart, offer code, checkout, orders, reviews, favourites) but a product is thin: name, brand, one description,
price/MRP, unit, stock, images and a four-value category. This document studies how Flipkart, Meesho, BigHaat,
IndiaMART and a dairy D2C site list products, then specifies what a Godhan listing should contain, how farmers
discover it, and how admins create it.

**Decisions taken with the product owner**

| Topic | Decision |
|---|---|
| Who sells | **Godhan only.** Admin adds every product. No seller accounts, commission or per-seller stock. An optional `sellerId` is kept in the model so multi-seller can come later. |
| Medicines | **OTC only** (tonics, minerals, dewormers, teat dips). No prescription drugs. A `prescriptionRequired` flag is documented but stays `false`. |
| Categories | Feed & fodder · Supplements & health · Milking & dairy equipment · Calf care & hygiene |
| Language | English only. Hindi / Gujarati / Marathi product content is a later item (the app's own UI strings are already translated). |
| GST and invoices | **GST rate is configurable** (admin-managed rate list plus a per-product choice). Godhan **issues GST invoices** for shop orders (§4.3). |
| Delivery charge | **Flat fee, free above a threshold.** Both values are admin-configurable (§4.4). |
| Returns | **No returns in this phase.** Every product shows "No returns" clearly; the return fields stay in the model, switched off, for a later phase. |
| Content reuse | Manufacturer photos and label text **may be reused**; keep the source on each product (§4.5). |
| Safety review | Decided in §4.6: dosage, withdrawal-period and warning text must be marked reviewed by a registered veterinarian before a product can go live. |
| Pricing | **MRP is mandatory.** An optional offer price below the selling price is allowed (independent of coupon codes). |

**Out of scope:** multi-seller marketplace, prescription drugs, translated product content, payments/wallet changes,
group procurement (see `godhan-feed-manager-architecture.md`, noted as a future link).

## 2. Research findings

Pages were read on 2026-10-11. Limits are stated honestly: Meesho returned HTTP 403 to automated fetch, Amazon.in could
not be retrieved, and some details come from third-party scraper documentation, so treat those as secondary.

### 2.1 Flipkart — search results (verified live)
Source: [flipkart.com search "cattle feed"](https://www.flipkart.com/search?q=cattle+feed) (2,504 results, 40 per page).

| Part | What it shows |
|---|---|
| Card | Image · title (brand + product + pack size, truncated) · pack size · rating with count (4.1, 3,411) · selling price · struck-through MRP · "45% off" · badges ("Only few left", "Only 1 left", "Saver Deal", "Lowest price in the year") |
| Filters | Category · Brand · Price slider (₹100–₹700+) · Customer rating (4★ & above, 3★ & above) · Discount · Country of origin · Offers (Buy more save more, Special price, No-cost EMI, New arrivals) · Availability: **GST invoice available** |
| Sort | Relevance (default) · Popularity · Price low→high · Price high→low |
| Navigation | Breadcrumb · "Showing 1–40 of 2,504 results" · numbered pagination "Page 1 of 63" |

### 2.2 Flipkart — product page (verified live)
Source: [VetMantra MMC 5 kg mineral mixture](https://www.flipkart.com/vetmantra-mmc-5-kg-mineral-mixture-cow-buffalo-sheep-goat-pet-health-supplements/p/itm2d43a28a1a30a?pid=PHSHFTU3ZXD6RNUB). The fetch was partial (no description or review breakdown came through).

- Breadcrumb, five levels: Home / Pet Supplies / Large Animals / Large Animal Health Supplements / brand range / product.
- Title, rating (4.1) and review count (3.4K+), selling price (₹259) and a "Buy at ₹246" offer price, pack-size selector ("5 kg").
- Delivery estimate with a **pincode prompt** ("Delivery by 19 Oct"), seller name with **seller rating** (4.0, "6 years with Flipkart") and "See other sellers".
- Policy chips: **Cancellation up to 24 hrs · No returns · Cash on Delivery · Flipkart Assured**.
- Specifications table: Sales Package, Brand, Model Number, Form (Powder), Quantity (5 kg), Suitable For (Cow, Buffalo, Sheep, Goat), Composition, Pet Type.
- Similar products strip with prices.

### 2.3 Meesho (secondary sources only; the site itself returned 403)
Sources: [seller guide](https://www.ithinklogistics.com/blog/how-to-create-use-manage-a-meesho-account-for-sellers-or-a-supplier-account/amp/), [catalog guide](https://base.com/en-IN/blog/?p=21018), [product page snippet](https://www.meesho.com/fasalvi-mother-bra-maroon/p/wouvt).

- Variants (size, colour, fabric) sit **under one listing**, each with its own price, so reviews and ratings stay together.
- A product-details table (fabric, net quantity, country of origin), a rating breakdown, and a "Sold By" block with supplier rating and followers.
- Returns are tied to damaged / wrong / incorrect-size items with photo or video proof inside a short window. The exact window was not confirmed by an official source.
- Lesson for Godhan: a low-price, high-COD mix means returns policy needs to be explicit on the page, not hidden.

### 2.4 BigHaat — agri and dairy specific (verified live)
Sources: [Dairy Supplements collection](https://www.bighaat.com/collections/dairy-supplements), [BVG Rajjo product](https://www.bighaat.com/products/bvg-rajjo-cattle-feed-supplements).

- Card: image · discount badge ("9% OFF") · rating and count · **product name** · seller name · price with a higher reference price · **pack-size selector** ("10 ltr (pack of 5 ltr × 2)", "1 kg", "250 ml") · Add to Cart / **Sold Out** / **Currently Unavailable**.
- "Load more…" instead of numbered pages. The dairy collection page showed no filters or sort at all (a weakness, not a pattern to copy).
- Menu: Animal Husbandry → Cattle and Poultry Essentials (Milking Machine, Milking Machine Accessories, Cattle Feed, Calf Feeding Bottle) and Cattle Supplements.
- Product page structure: breadcrumb, brand, availability, tabs **Product Details / Explore / Reviews / FAQs**, Similar Products, Bulk Order Inquiry, FAQ on COD and UPI/cards. Page content was mostly empty for the unavailable item.

### 2.5 IndiaMART — B2B listing cards (verified live)
Source: [Cattle Feed Supplement](https://m.indiamart.com/impcat/cattle-feed-supplement.html).

- Card: image · name · **price with unit** ("₹400/Kg", "₹90/Pack") · short attribute bullets (cattle type, form, supplement type, pack size) · seller company, city, years in business · rating · TrustSEAL badge · "Best Price / WhatsApp / Call Now".
- Filters: seller type (manufacturer, wholesaler, retailer), **form** (Powder, Pellet, Granules, Liquid, Bolus), location, price bands (below ₹150, ₹151–₹300, ₹301–₹700, above ₹701).
- Sub-category chips worth borrowing: Cattle Feed Additives, Rumen Bypass Fat, Anti-Mastitis Feed Supplement, Cattle Digestive Tonic, Cattle Vitamins, Salt Lick Block, Mineral Mixture, Chelated Minerals.

### 2.6 Delmer — dairy D2C product page (verified live)
Source: [Delmer Mineral Mixture Powder, 1 kg](https://delmergroup.com/products/del-mineral-mixture-powder).

- Seven-image gallery that includes **ingredients, dosage, benefits and packaging** shots (not only a hero photo).
- Description in sections: overview · key ingredients · benefits · **recommended dosage table by animal** (cattle/buffalo 35–50 g/day, calves 15–20 g/day) · how to use · suitable animals · why chelated · packaging and storage · **10 FAQs** · related products · brochure link · "Ask a question" form.
- Weak points to avoid: no MRP/discount shown, no pack-size choice, no rating displayed, no shipping/returns on the page, no certifications.

### 2.7 What these sites have in common (and what dairy needs extra)

| Common to all | Dairy / livestock extra (missing on general shops) |
|---|---|
| Multi-image gallery, brand, title with pack size, price + MRP + % off, rating + count, stock state, specs table, similar products, filters by brand/price/rating, sort | Dosage **per animal type and age**, milk **withdrawal period**, suitable-for (cow / buffalo / calf / goat), form (powder, liquid, pellet, bolus, block), composition per kg, storage and shelf life, BIS standard (e.g. IS 1664:2002 for mineral mixtures), manufacturer licence/batch, equipment power/capacity/warranty |

Reference standard: [BIS IS 1664:2002](https://services.bis.gov.in/tmp/tbl5_2024-11-11-08-19.pdf) (mineral mixture for cattle feeds, Type 1 and Type 2).

## 3. Gap analysis — what Godhan has today

Confirmed from `marketplace-service/models/product.model.js`, `routes/marketplace.routes.js`, admin `pages/products`, app `MarketModels.kt` and `ui/screens/market/dairy/`.

| Area | Today | Gap |
|---|---|---|
| Product fields | `name, category(feed/medicine/equipment/supplement), brand, description, price, mrp, unit, stock, images[], ratings, reviews[], isVerified, favoritedBy` | No variants/pack sizes, SKU, sub-category, tags, short description, highlights, dosage, composition, specs, GST, policy, status, withdrawal period |
| Discount | Computed from `mrp` vs `price` in the app | Fine, but no "offer price" |
| API | `POST /product` (admin), `GET /product?category&q` (q = name regex), detail, stock delta, image upload/delete, favourites, reviews, moderation | **No update or delete**, no pagination, sort, price/stock/brand filter, search only on name |
| Admin | Create form + inline stock +/- and image upload/remove | No edit, delete/archive, search, filter, pagination, multi-file upload, reordering, variants, specs, `isVerified` toggle |
| App list | Category chips, name search, card with image/discount/verified/brand/rating/price | No sort, price or rating filter, sub-categories, pagination |
| App detail | Image pager, badges, "Only N left", brand, price/MRP, rating, reviews | No pack-size selector, highlights, dosage, specs, policy, delivery estimate, similar products |
| Kept as is | Cart (client-side), offer codes, checkout with wallet/coins, orders, purchase-anchored reviews, favourites | — |

## 4. Target data model

### 4.1 Product (parent)

| Group | Field | Type | Notes |
|---|---|---|---|
| Identity | `name` | string, required | Brand + product + key attribute, ≤120 chars (Flipkart style) |
| | `slug` | string, unique | for share links and SEO later |
| | `brand` | string | filter facet |
| | `category` | enum | `feed_fodder`, `supplements_health`, `milking_equipment`, `calf_care_hygiene` (see §5 migration) |
| | `subcategory` | string | from the category tree in §5 |
| | `tags[]` | string | search and filters ("A2", "bypass fat", "organic") |
| | `status` | enum | `draft`, `active`, `archived` (replaces hard delete) |
| | `isVerified` | bool | existing "Godhan verified" badge |
| | `sellerId` | string, optional | unused now (Godhan only); reserved for multi-seller |
| Media | `images[]` | `{url, alt, order}` | up to 8; first is the card image; recommended shots: front, back, ingredients/label, dosage chart, in-use, packaging |
| | `videoUrl` | string, optional | short usage clip |
| Content | `shortDescription` | string ≤160 | card/search snippet |
| | `highlights[]` | string | 3–6 key-feature bullets |
| | `description` | text | long form (Delmer-style sections can be authored as plain paragraphs) |
| | `composition[]` | `{ingredient, amount}` | per kg / per ml; amount optional |
| | `dosage[]` | `{animal, ageGroup, amount, frequency}` | e.g. cow/buffalo adult · 35–50 g · daily |
| | `howToUse` | text | |
| | `suitableFor[]` | enum | `cow`, `buffalo`, `calf`, `heifer`, `goat`, `sheep` |
| | `form` | enum | `powder`, `liquid`, `pellet`, `granules`, `bolus`, `block`, `gel`, `equipment`, `other` |
| | `storage`, `shelfLifeMonths` | string, number | |
| | `manufacturer`, `countryOfOrigin`, `licenceNo` | string | licence/registration number printed on the pack |
| | `certifications[]` | string | e.g. "BIS IS 1664", "ISI", "FSSAI" where applicable |
| | `warnings` | text | safety and precautions |
| | `withdrawalPeriodDays` | number, optional | milk withdrawal period; **show prominently for dewormers, tonics with active drugs, teat dips** |
| | `prescriptionRequired` | bool, default `false` | stays `false` (OTC-only decision) |
| | `specifications[]` | `{label, value}` | driven by per-category templates (§5) |
| | `faqs[]` | `{question, answer}` | optional, from Delmer's pattern |
| Policy | `returnable`, `returnWindowDays` | bool, number | **`returnable: false`, `returnWindowDays: 0` for every product in this phase**; the app shows a "No returns" chip (as Flipkart does for consumables). Fields stay so returns can be switched on later without a migration. |
| | `cancellableUntilShipped` | bool | |
| | `codAvailable` | bool | |
| | `deliveryEstimateDays` | number | until pincode serviceability exists |
| | `gstRate`, `hsnCode` | number, string | `gstRate` is chosen from the admin-managed GST rate list (§4.3); `hsnCode` printed on the invoice |
| | `freeDelivery` | bool, optional | overrides the delivery fee rule for a product (e.g. heavy items excluded from free delivery) |
| Content source | `contentSource` | `{kind, name, url}` | where reused manufacturer text/photos came from (§4.5) |
| | `contentReview` | `{reviewedBy, reviewedAt, note}` | veterinary sign-off (§4.6) |
| Social | `ratings`, `reviews[]`, `favoritedBy[]` | existing | unchanged; Q&A is a later item |
| Housekeeping | `createdAt`, `updatedAt` | existing timestamps | "New" badge = created in the last 14 days |

### 4.2 Variant (pack size) — one product, several sellable sizes
Meesho and BigHaat both put pack sizes under **one listing** so reviews are shared. Godhan does the same.

| Field | Type | Notes |
|---|---|---|
| `sku` | string, unique | e.g. `VM-MMC-5KG` |
| `label` | string | "5 kg", "1 L", "Pack of 2 × 5 L" |
| `packSize` | `{value, unit}` | enum unit: `g, kg, ml, l, piece, pack` |
| `mrp` | number, **required** | printed MRP of the pack; `mrp ≥ price` is validated |
| `price` | number, required | Godhan selling price (the discount shown is `mrp` → `price`) |
| `offerPrice`, `offerEndsAt` | number, date; optional | promotional price below `price` (Flipkart's "Buy at"), shown with a strike-through of `price`; independent of coupon codes; ignored after `offerEndsAt` |
| `stock`, `lowStockThreshold` | number | "Only N left" badge below the threshold (today fixed at 10) |
| `weightGrams` | number | for later shipping rules |
| `barcode` | string, optional | |
| `isDefault` | bool | the variant shown on the card |

### 4.3 GST and invoices (decided: configurable rate, GST invoices issued)

- **Rate list:** an admin-managed list of allowed GST rates (for example 0, 5, 12, 18 %) kept in the shared config
  (`core.utils.config.getConfig`, the same mechanism other Godhan services use) so a rate change needs no release.
  Each product picks one rate and an HSN code; the category template suggests a default.
- **Price basis:** MRP and selling price are **tax-inclusive** (Indian retail norm). The invoice splits the tax out:
  `taxable = line total ÷ (1 + rate)`, `GST = line total − taxable`. The app shows "Inclusive of all taxes".
- **Order fields (new):** per line `gstRate`, `hsnCode`, `taxableValue`, `gstAmount`; order-level `deliveryFee`,
  `gstTotal`, `invoiceNumber`, `invoiceDate`.
- **Invoice:** generated when an order is paid (PDF, downloadable in My Orders and from the admin Orders page). Needs seller
  details in config: legal name, address, **GSTIN**, state, invoice prefix; CGST/SGST vs IGST chosen from the delivery address
  state. Numbering is sequential per financial year.
- **Filter:** "GST invoice available" (Flipkart pattern) is not needed while every order gets one.
- **Before launch:** the invoice layout and tax split must be confirmed by Godhan's accountant (§10).

### 4.4 Delivery charge (decided: flat fee, free above a threshold)

- Two admin-configurable values in the shared config: `deliveryFlatFee` (₹) and `freeDeliveryAbove` (₹ order value; 0 = never free).
- Rule at checkout: `deliveryFee = 0` if the cart subtotal ≥ `freeDeliveryAbove` (or every line has `freeDelivery: true`), else `deliveryFee = deliveryFlatFee`.
  Evaluated on the amount **after** coupon discount (decision to confirm in §10).
- The cart and checkout show the fee line and a hint such as "Add ₹120 more for free delivery". The delivery fee is part of
  the order total and appears on the invoice. With no returns in this phase, no delivery-fee refund rules are needed yet.
- Config is read on every request (no redeploy); an admin **Settings** screen edits GST rates, fee, threshold and seller details.

### 4.5 Reusing manufacturer photos and label text (decided: allowed)

- Reuse is allowed. For traceability every product stores `contentSource` (manufacturer name, URL or document, date reused).
- Rules: keep label text (composition, dosage, warnings) **verbatim** rather than paraphrasing; do not crop out the brand,
  licence number or batch/MFG-expiry panel; show images at least 800 px on the long side; keep the manufacturer's
  name in the "Manufacturer" field. If a manufacturer later objects, the product can be archived without losing order history.

### 4.6 Safety review of dosage, withdrawal period and warnings (my decision, as requested)

Wrong dosage text can harm an animal, and the feed-manager and vet documents already require professional sign-off. For the shop:

1. **Two content classes.** *General* content (title, photos, highlights, specs) goes live with admin approval only.
   *Clinical* content (dosage, how-to-use, withdrawal period, warnings, composition claims) needs a **veterinary review**.
2. **Gate:** a product in `supplements_health`, `calf_care_hygiene` (hygiene products with an active ingredient) or any product
   with a dosage table or `withdrawalPeriodDays` cannot move from `draft` to `active` until `contentReview` is filled
   (reviewer name, date, note). Feed and equipment products are exempt unless they carry a dosage table.
3. **Source rule:** clinical text must be the manufacturer's label text (§4.5) or the reviewer's own wording; the admin cannot
   free-write dosage numbers without a reviewer.
4. **On the page:** a fixed note under dosage — "Follow the pack label and your veterinarian's advice. For a sick animal,
   consult a vet." — and the withdrawal period highlighted wherever it is set.
5. **Re-review** is required whenever dosage, withdrawal period or composition changes (the gate sets the product back to `draft`).
6. **Reviewer:** a registered veterinarian named by Godhan (an admin user flag `isVetReviewer` is enough for phase 1).
7. **Out of scope:** prescription drugs (OTC-only decision), so no per-farmer dose calculation in the shop.

### 4.7 Migration from the current schema
- `unit`, `price`, `mrp`, `stock` become the **default variant** (`label` = `1 {unit}`); existing orders keep their `productId` + `price` snapshot, so history is unaffected.
- Category mapping: `feed → feed_fodder`, `supplement → supplements_health`, `equipment → milking_equipment`, `medicine → supplements_health` (sub-category "OTC health products"; any real prescription drug is archived, per the OTC-only decision). `calf_care_hygiene` is new.
- The app and the old fields keep working during the transition: the API keeps returning `price/mrp/stock/unit` from the default variant until the app is updated.

## 5. Category tree and spec templates

| Category | Sub-categories | Spec fields (template) |
|---|---|---|
| **Feed & fodder** (`feed_fodder`) | Compound cattle feed · Bypass fat · Silage and fodder seed · Salt lick block · Calf starter | Crude protein %, fat %, fibre %, moisture %, ash %, form, pack size, shelf life, intended stage (lactating / dry / calf) |
| **Supplements & health** (`supplements_health`) | Mineral mixture · Calcium · Liver tonic · Vitamins · Probiotics and digestive · Dewormer (OTC) · Anti-mastitis support (OTC) | Composition per kg/ml, dosage by animal, form, pack size, withdrawal period, BIS/licence number |
| **Milking & dairy equipment** (`milking_equipment`) | Milking machine · Milking accessories · Milk cans and buckets · Chaff cutter · Milk tester (lactometer, fat analyser) · Milk cooler | Power source, power rating, capacity (cows or litres), material, warranty, installation/service, included items |
| **Calf care & hygiene** (`calf_care_hygiene`) | Milk replacer · Feeding bottle and nipple · Teat dip and spray · Sanitizer and disinfectant · Ear tags · Cattle fan and mister | Age group, volume/size, material, active ingredient (hygiene), dilution/usage, pack size |

Spec templates are stored once per category (admin-editable) so the admin form shows the right rows and the app renders a
consistent "Specifications" table, instead of free-form text.

## 6. App — listing and detail

### 6.1 Listing screen
- **Card:** image · title (brand + name + default pack size) · rating + count · price · struck MRP · "% off" · badges (**X% off, Only N left, Out of stock, New, Godhan Verified**) · favourite heart.
- **Search:** over name, brand, tags (today: name only). Debounced; later add suggestions.
- **Filters** (bottom sheet): category and sub-category · brand · price range · rating 4★+ · discount · **suitable for** (cow, buffalo, calf…) · **form** (powder, liquid, pellet…) · in stock only · GST invoice available.
- **Sort:** Relevance · Popularity (orders count) · Price low→high · Price high→low · Newest · Discount.
- **Pagination:** infinite scroll with a page size of 20, plus a result count ("120 products").
- **Empty and out-of-stock states:** "Sold Out" cards stay visible but cannot be added; "No products match" offers a clear-filters action.

### 6.2 Detail screen — section order
1. Breadcrumb (Category › Sub-category) and image gallery with zoom and swipe; video if present.
2. Title, brand, Godhan Verified badge.
3. Rating summary (tap to jump to reviews).
4. Price, MRP and % off; when an active `offerPrice` exists show it as "Buy at" with the selling price struck through; "Inclusive of all taxes" (§4.3).
5. **Pack-size selector** (variants) with price and stock per size.
6. Delivery estimate (days; pincode check later), the delivery-fee rule ("Free delivery above ₹X" or "Delivery ₹Y", §4.4) and policy chips: **COD · No returns · Cancellation**.
7. Highlights (bullets) and short description.
8. Add to cart / Buy now; favourite; share.
9. Description (expandable).
10. **Dosage and usage** (table by animal/age) and **withdrawal period** callout where set; warnings.
11. Specifications table (from the category template) and composition.
12. FAQs (if any).
13. Reviews (approved only, existing) with rating breakdown.
14. Similar products (same sub-category) and "Other sizes" chips.

Cart, offer code, checkout and orders are unchanged apart from showing the **variant label** on each line.

## 7. Admin portal

Reuse what already exists in `godhan-admin`: the shared filter bar and pager styles (`styles.scss`), the cascading filter pattern from the Bulls page, the details popup with admin-only edit, and the CSV import flow from the Bull catalog.

- **Product list:** search, filters (category, sub-category, brand, status, low stock, missing content), 25/50/100 per page, thumbnail column, status chip, stock total, listing-quality indicator.
- **Create / edit form** (tabbed popup or page): Identity · Media · Variants · Content · Specifications · Policy.
  - Media: multi-file upload (JPEG/PNG/WebP, 5 MB each, existing limit), drag to reorder, alt text, delete, "set as primary".
  - Variants: add rows (label, pack size, price, MRP, stock, SKU), mark default; stock adjust (+/−) kept.
  - Specifications: rows appear from the chosen category template.
  - Status: draft / active / archived (no hard delete; archived products disappear from the app but stay in old orders).
- **Listing-quality checklist** (shown in the form, not blocking): ≥3 images · short description · 3+ highlights · dosage (for supplements) · specs filled · policy set.
- **CSV bulk import** (dry run first, then apply — same pattern as `POST /bulls/admin/import` and `bullImport.js`): one row per variant; columns include `sku, name, brand, category, subcategory, label, price, mrp, stock, shortDescription, highlights (|-separated), suitableFor (|), form, imageUrls (|), …`. Rows with the same product key are grouped into one product with several variants.
- **Veterinary review panel** (§4.6): on products with clinical content, a vet-reviewer user records name, date and note; the Status switch to `active` stays disabled until it is filled, and editing dosage, withdrawal period or composition resets the product to `draft`.
- **Content source** field (§4.5) next to the media and content tabs.
- **Shop settings page (new):** GST rate list, delivery flat fee, free-delivery threshold, and seller invoice details (legal name, address, GSTIN, state, invoice prefix).
- Orders page gains an invoice download; reviews moderation and offers pages stay as they are.

## 8. API changes (marketplace-service)

| Endpoint | Change |
|---|---|
| `GET /product` | Add `page`, `limit`, `sort` (`relevance, popular, price_asc, price_desc, newest, discount`), `minPrice`, `maxPrice`, `brand`, `subcategory`, `suitableFor`, `form`, `inStock`, `minRating`; search `q` over name, brand, tags. Response gains `total`, `page`, `pages`. Defaults keep the current behaviour so the shipped app keeps working. |
| `PUT /product/:id` (admin) | **New:** edit any field. |
| `DELETE /product/:id` (admin) | **New:** archive (sets `status: "archived"`). |
| `POST/PUT/DELETE /product/:id/variants[/:sku]` (admin) | **New:** manage variants and per-variant stock. The existing `POST /product/:id/stock` keeps working on the default variant. |
| `PUT /product/:id/images/order` (admin) | **New:** reorder, set alt text. |
| `POST /product/admin/import` (admin) | **New:** CSV import (dry run / apply, ≤300 rows per request). |
| `GET /product/categories` | **New:** category tree and spec templates, so admin and app never hard-code them. |
| `GET /shop/config` | **New (public):** delivery flat fee, free-delivery threshold, GST rate list, "No returns" policy text; the app and checkout read it instead of hard-coding. |
| `PUT /shop/config` (admin) | **New:** edit GST rates, delivery fee, threshold and seller invoice details (legal name, address, GSTIN, state, invoice prefix). Stored through the shared config mechanism. |
| `POST /order/preview-discount`, `POST /order/checkout` | Gain `deliveryFee`, `gstTotal` and per-line tax split in the response; fee computed server-side from `shop/config` (the client value is never trusted). |
| `GET /order/:id/invoice` | **New:** GST invoice PDF for a paid order (farmer for own orders, admin for any). |
| `PUT /product/:id/content-review` (admin vet reviewer) | **New:** records `contentReview`; required before a clinical product can be `active` (§4.6). |
| Orders | Order line items gain `variantSku`, `variantLabel`, `gstRate`, `hsnCode`, `taxableValue`, `gstAmount`; order gains `deliveryFee`, `gstTotal`, `invoiceNumber`, `invoiceDate`. |

## 9. Phased rollout

| Phase | Scope | Why this order |
|---|---|---|
| 1 — Content and admin | New product fields (incl. `mrp` required, `offerPrice`, GST rate/HSN, `returnable: false`), category tree, edit/archive, multi-image + reorder, admin list search/filter/pagination, CSV import, admin **Shop settings** (GST rates, delivery fee/threshold, seller details), veterinary content-review gate | The catalog must be rich before the app can show it; the app keeps working on defaults |
| 2 — App discovery | Server-side pagination, filters, sort, search over brand/tags; richer card and detail sections (highlights, dosage, specs, policy) | Biggest farmer-visible improvement |
| 3 — Variants, delivery fee and invoices | Pack-size selector in the app, per-variant stock/price in cart and orders, delivery fee + free-delivery hint at checkout, GST tax split and invoice PDF | Needs the Phase-1 model, settings and an order-schema change; invoice layout needs accountant sign-off first |
| 4 — Extras | Returns (turn on `returnable`), Q&A, recently viewed, similar products, delivery check by pincode, "frequently bought together", group-procurement link to the feed manager | Depends on traffic and logistics decisions |

## 10. Decisions and remaining questions

### Resolved (2026-10-11)

| # | Question | Decision | Where in this document |
|---|---|---|---|
| 1 | GST and invoices | GST rate is configurable; Godhan issues GST invoices | §4.3 |
| 2 | Delivery charge | Flat fee, free above a threshold, both configurable | §4.4 |
| 3 | Returns | No returns in this phase; fields kept switched off | §4.1 Policy, §9 Phase 4 |
| 4 | Content sourcing | Manufacturer photos and label text may be reused; source recorded per product | §4.5 |
| 5 | Safety review | Veterinary review gate for dosage, withdrawal period and warnings (decided by the assistant, to confirm) | §4.6 |
| 6 | Pricing | MRP mandatory; optional offer price allowed | §4.2 |

### Still open

1. **Seller / invoicing details:** the legal entity, GSTIN, registered address and state, and the invoice number format. These go
   into the admin Shop settings. The GST rate and HSN per product, and the CGST/SGST vs IGST split, must be confirmed by the accountant.
2. **Free-delivery threshold basis:** compare the cart subtotal **before** or **after** coupon discount? (Proposed: after discount.)
3. **Who ships and where:** Godhan, the brand, or a courier; are there pincodes Godhan cannot serve? (Not needed until the Phase 4 pincode check.)
4. **Veterinary reviewer:** who is the first named reviewer, and is one reviewer enough for launch? (Confirms §4.6.)
5. **Stock model:** one stock count per variant (assumed), or a warehouse concept later?
6. **Starting catalog:** which brands and roughly how many products at launch, and who prepares the first CSV?

## Sources

- [Flipkart search — cattle feed](https://www.flipkart.com/search?q=cattle+feed) · [Flipkart — VetMantra MMC 5 kg](https://www.flipkart.com/vetmantra-mmc-5-kg-mineral-mixture-cow-buffalo-sheep-goat-pet-health-supplements/p/itm2d43a28a1a30a?pid=PHSHFTU3ZXD6RNUB)
- [BigHaat — Dairy Supplements](https://www.bighaat.com/collections/dairy-supplements) · [BigHaat — BVG Rajjo](https://www.bighaat.com/products/bvg-rajjo-cattle-feed-supplements)
- [IndiaMART — Cattle Feed Supplement](https://m.indiamart.com/impcat/cattle-feed-supplement.html)
- [Delmer — Mineral Mixture Powder](https://delmergroup.com/products/del-mineral-mixture-powder)
- Meesho (secondary): [iThink Logistics seller guide](https://www.ithinklogistics.com/blog/how-to-create-use-manage-a-meesho-account-for-sellers-or-a-supplier-account/amp/), [Base.com catalog guide](https://base.com/en-IN/blog/?p=21018), [Meesho product page](https://www.meesho.com/fasalvi-mother-bra-maroon/p/wouvt)
- [BIS IS 1664:2002 listing](https://services.bis.gov.in/tmp/tbl5_2024-11-11-08-19.pdf)
- Internal: `godhan-services/marketplace-service/models/product.model.js`, `routes/marketplace.routes.js`, `godhan-admin/src/app/pages/products`, `godhan-app/shared/.../MarketModels.kt`, `ui/screens/market/dairy/`, `docs/GODHAN_APP_FEATURE_STATUS.md`, `docs/DEVELOPMENT_PLAN.md`.

## Phase 1 implementation notes (2026-10-11)

What was built, and where it differs from the sections above:

- **Backend** (`marketplace-service`): new product fields, product update / archive (`PUT` and `DELETE /product/:id`), admin list with filters and paging (`GET /product/admin`), image reorder with alt text (`PUT /product/:id/images/order`, at most 8 images), veterinary review (`PUT /product/:id/content-review`), CSV import (`POST /product/admin/import`), category tree (`GET /product/categories`) and shop settings (`GET /shop/config` public, `GET`/`PUT /shop/settings` admin). The public `GET /product` also gained page / sort / filter parameters; **without `page`/`limit` it still returns the plain array the shipped app expects**. Rules are in `services/productRules.js` (unit-tested, 12 tests) and the end-to-end API test ran 46 checks.
- **Category keys were not renamed.** To keep the shipped app working, the keys stay `feed`, `supplement`, `equipment`, `medicine`, and `calf_care` is new. Labels are the spec names ("Feed & fodder", "Supplements & health", "Milking & dairy equipment", "Calf care & hygiene"); `medicine` is shown as "OTC health products". Renaming the keys (§4.7) waits for the app update.
- **Variants are not built yet** (Phase 3). `price`, `mrp`, `stock` and `unit` stay on the product, which acts as the default variant.
- **Offer price** is stored and editable, but neither the app nor checkout uses it yet, so farmers still pay and see the selling price (it would otherwise be charged without being shown). It switches on in Phase 2 together with the app display.
- **Drafts and archived products are hidden** from the app and refused at checkout; products created before the `status` field existed count as live.
- **Veterinary review:** any admin can record it by typing the reviewer's name (there is no per-user "vet reviewer" flag yet, because the login token carries only the role). Clinical products default to `draft`, cannot be created or saved as live without a review, and editing dosage / how-to-use / withdrawal period / warnings / composition clears the review and returns a live product to draft. CSV import holds such products back as `draft` instead of failing.
- **Returns and prescription products are refused by the API** (`returnable: true`, `prescriptionRequired: true`), matching the "no returns" and "OTC only" decisions.
- **Shop settings** (GST rate list, delivery flat fee, free-delivery threshold, seller invoice details) are stored in the shared config; they are **not yet applied at checkout** (Phase 3). The GSTIN format is validated.
- **Admin portal:** Products page (server-side search / filters / paging, details popup with admin-only edit tabs: Identity, Pricing & tax, Content, Specifications, Media, Delivery & policy, Veterinary review), CSV import with template, and a Shop Settings page. `contentSource` uses the field name `kind` (not `type`).

## Phase 2 implementation notes (2026-10-11)

What was built for the farmer app and the API behind it, and where it differs from sections 6 and 8:

- **Shop listing (app):** server-side paging (20 per page, infinite scroll), a result count, sort (Relevance, Popularity, Price low to high / high to low, Newest, Discount), and a Filters sheet (type, brand, price range, suitable for, form, 4-star and above, in stock only) with an active-filter badge. Search is debounced and now matches name, brand, tags and short description. A stale response can never overwrite a newer search because the previous request is cancelled. Category chips gained **Calf care**; labels are Feed, Supplements, OTC health, Equipment, Calf care.
- **Cards:** brand, rating only when there are reviews, price with struck MRP, badges (X% off, Only N left, Out of stock, New for 14 days), and a disabled "Sold out" button.
- **Detail screen:** breadcrumb, offer-price label, price and savings with "Inclusive of all taxes", delivery / COD / no-returns / cancellation chips, highlights and short description, expandable description, dosage table with the milk withdrawal-period callout, how to use, warnings and the fixed veterinary note, specifications (including composition, shelf life, storage, manufacturer, origin, certifications), FAQs, then reviews. Each section is hidden when the product has no data for it, so older products still look clean.
- **Offer price is now live.** The API computes one *effective price* (`effectivePrice` in `productRules.js`): the offer price while it is set, lower than the selling price and not past `offerEndsAt`; otherwise the selling price. The same function prices the item in the listing, the detail, the discount preview and checkout, so the farmer pays exactly what they see. The API returns the payable amount as `price`, the regular price as `listPrice` and a boolean `onOffer`, so the **shipped app also shows and is charged the offer price**.
- **Known limitation:** the server-side price filter and the price sort still use the regular selling price, not the offer price. For a small offer discount the order is almost identical; making them offer-aware needs a stored effective-price field and is left for later.
- **API additions:** the paged `GET /product` response now includes `brands` and `subcategories` for the chosen category (to fill the filter sheet), the `calf_care` category key is accepted everywhere, and the unpaged call still returns a plain array.
- **Not in Phase 2:** the pack-size selector, per-variant stock, delivery fee and GST invoice stay in Phase 3. "Similar products" and "Other sizes" stay in Phase 3/4.
- **Tested:** 13 unit tests, 46 Phase 1 API checks (no regressions) and 14 Phase 2 API checks on a scratch database, and the Android app compiles. It has not yet been run on a device, because that needs the new marketplace-service deployed first.

## UX redesign follow-up (2026-10-11)

The farmer-app look-and-feel and checkout redesign is in `DAIRY_SHOP_UX_REDESIGN.md` (with a clickable mockup, `DAIRY_SHOP_UX_MOCKUP.html`). Its app-only first slice is built: richer shop home and cards, a card-based product page with a foldable Specifications section, a cart with price details and coupons, a three-step checkout (address, payment, review), a confirmation and an order-detail screen, and the Dairy Shop as a bottom-bar tab. Delivery fee, GST rows, the pincode check, saved addresses on the server, cancel with refund and online payment remain for the backend phases described there.
