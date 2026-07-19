# Cattle Image Upload → Health Prediction: Current State & Suggested Approach

**Compiled:** 2026-07-18
**Scope:** Cattle photo carousel (mobile app + `cattle-service`) and image-based health prediction
(`cattle-iot-prediction`). A chatbot symptom-checker was raised in the same conversation but is a
**future plan** — not scoped here.

---

## 1. What's already built

Verified against the actual code, not just prior docs — the "upload photo → show in carousel"
half is fully built and working:

- **`cattle-service`**: `Cattle.images: [String]` (S3, or the mock-upload fallback since no real
  AWS credentials are configured yet), with `POST /:id/images` and `DELETE /:id/images` routes.
- **Mobile app**: `CattleDetailScreen` has a real `CattleImageCarousel` (swipeable
  `HorizontalPager`, page dots, delete-on-long-press) wired to `vm.uploadImage(bytes)`, using the
  OS's native picker (`rememberImagePickerLauncher`) — no custom camera permission needed.

The plumbing a health-prediction feature would depend on — farmers reliably attaching photos to a
specific animal — already exists and works end to end.

## 2. What's missing for image-based health prediction

This part is **0% built**. Re-read `cattle-iot-prediction` in full — it does heat detection
(RandomForest on temperature/accelerometer/rumination deltas) and calving prediction (rule-based),
entirely from IoT sensor readings. There is no image-handling code anywhere in it — no OpenCV, no
PIL, no torch/tensorflow, nothing. Concretely missing:

- No trigger point that runs anything when a photo is uploaded (upload today just stores a URL,
  nothing downstream reacts to it)
- No model of any kind for detecting visible health issues from a photo (skin lesions, wounds,
  discharge, lameness posture, body condition)
- No results storage (nowhere to put "this photo shows a possible concern" today)
- No UI to surface a result even if one existed

## 3. Suggested approach

**Where it should live**: `cattle-iot-prediction`, not `cattle-service`/`godhan-cattle-iot`. The
platform's own dev plan already draws this line deliberately ("spec calls for AI in Python
specifically — keep that boundary") — image inference belongs with the other ML work, not bolted
onto a Node CRUD service.

**The real fork in the road is the model approach:**

| Approach | What it takes | Trade-off |
|---|---|---|
| **Custom-trained CV classifier** (e.g. a CNN fine-tuned to detect specific conditions) | Thousands of vet-confirmed labeled images per condition — a dataset that doesn't exist yet anywhere in this platform | Most accurate long-term, but a data-collection project measured in months, not a buildable feature right now |
| **Multimodal LLM as a triage layer** (send the photo + farmer's description to a vision-capable model, ask it to flag visible abnormalities) | An API integration — buildable in the next block of work | Advisory-quality, not diagnostic — needs to be framed to farmers as "possible concern, consult your vet," not a clinical diagnosis. That framing matters legally, not just technically |

Given there's no labeled dataset today, start with the multimodal-LLM path: a
`POST /predict/health-check` endpoint in `cattle-iot-prediction` that takes an uploaded image,
calls a vision-capable model for a first-pass triage read, stores the result (condition flagged,
confidence/severity, advisory text) against the cattle record, and surfaces it in the app — e.g. a
badge on the image carousel or a new "Health Insights" section. This also naturally builds a
growing set of (photo, farmer-reported outcome) pairs over time — exactly the seed data you'd
eventually want if you later decide to train a custom model.

## 4. Adjacent opportunities ("and many more")

The same image pipeline, once flowing, would unlock later:

- Body-condition-score trending from repeated photos over time
- Breed/grade cross-verification against the manually-entered grade
- Marketplace listing photo quality checks (Cattle Hub already shows these same cattle images)

## 5. Explicitly out of scope for now

- **Chatbot symptom-checker** (describe issue + optionally upload an image of the affected area,
  get suggestions, get asked follow-up questions) — flagged by the user as a future plan, not to
  be designed or built as part of this pass.

## 6. Suggested next step

Scope and build the first slice: the `cattle-iot-prediction` health-check endpoint and how it
plugs into the existing image upload flow, before going further.
