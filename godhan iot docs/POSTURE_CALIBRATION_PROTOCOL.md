# Posture threshold field calibration protocol

## Why this exists

`esp_32_firmware_skeleton.cpp`'s `classifyPosture()` uses three threshold constants
(`POSTURE_WALK_MAG_THRESH_G`, `POSTURE_GRAZING_TILT_DEG`, `POSTURE_LYING_ACCZ_THRESH_G`) to turn
raw accelerometer readings into `standing | lying | walking | grazing`. The current values were
carried over from an unused, never-validated firmware draft
(`docs/olddocs chatgpt/CattleCare_All_Documents/cattle_firmware/`) — nobody has ever checked them
against a real animal.

There's no shortcut around this with published research: neck-collar posture classification in
the literature is either done with a fundamentally different mounting (leg-mounted tilt sensors
like IceTag, whose orientation-vs-posture relationship doesn't transfer to a neck collar) or with
a decision tree/ML classifier trained on labeled accelerometer data — which is exactly what this
protocol produces the input for. `calibrate_posture_thresholds.mjs` (same folder) fits the three
thresholds against labeled data via grid search once you have it. This document is how to get
that data.

## What you need

- One collared animal, firmware flashed with the current build (so `sensor_data` is real, not
  simulated — see the Tier 0 fix in `docs/Godhan_Vision_Layer_Spec_Analysis.md`).
- One observer with a phone/notebook and a clock, free to watch that one animal continuously for
  the session.
- ~45–60 minutes per animal. Repeat across **at least 3 animals** of different builds/breeds if
  possible — a threshold tuned on one animal's exact collar fit will not generalize well, and the
  current design intentionally doesn't account for per-animal variation.

## Procedure

1. **Sync clocks.** Note the exact current time from the same source `sensor_data.timestamp` will
   use (server receipt time — see the "no RTC/NTP" caveat in `esp_32_firmware_skeleton.cpp`'s
   header comment). A few seconds of drift is fine; minutes are not.

2. **Observe and log bout boundaries, not individual moments.** Every time the animal's posture
   changes, write down: `start time, end time, posture`. Posture is exactly the four labels
   `classifyPosture()` produces — `standing`, `lying`, `walking`, `grazing` (head down while
   stationary, eating). If a bout is ambiguous (transitioning, obscured) don't log it — a missing
   bout is fine, a mislabeled one poisons the fit.

3. **Try to cover all four postures within the session.** Lying and walking bouts are usually easy
   to catch; grazing needs the animal to be at pasture or given fodder during observation, not
   just standing idle — an all-standing session produces a fit that can't say anything useful
   about the other three thresholds (the tool will warn you about this — see "sparse" warning
   below).

4. **Export the matching `sensor_data` window** for that animal and time range (via
   `GET /api/data/:cattleId?limit=...` on `godhan-cattle-iot`, or a direct MongoDB query if you
   have DB access — `db.sensor_data.find({cattleId, timestamp: {$gte, $lte}}).sort({timestamp:1})`).

5. **Join each reading to your logged bouts** to build `labeled-readings.csv`:

   ```csv
   timestamp,accX,accY,accZ,label
   2026-07-24T09:03:12.000Z,0.02,-0.01,0.97,standing
   2026-07-24T09:08:45.000Z,0.31,0.04,0.06,lying
   ...
   ```

   Two things to get right:
   - **Units**: `sensor_data.accX/Y/Z` are logged in m/s² (Adafruit_MPU6050's native unit). Divide
     each by `9.80665` before writing the CSV — the calibration tool works in g, same as
     `classifyPosture()` does internally.
   - **A reading only gets a label if its timestamp falls inside one of your logged bouts.** Drop
     anything from the gaps between observed bouts, and anything from a bout you marked ambiguous.

6. **Run the tool**:
   ```
   node "docs/godhan iot docs/calibrate_posture_thresholds.mjs" labeled-readings.csv
   ```
   It reports a label-distribution summary (and warns if any posture has fewer than 20 labeled
   readings — don't trust that threshold yet if so), a best-fit macro-F1 score, the three
   threshold values, and a confusion matrix so you can see exactly which postures get confused
   with which.

7. **Only paste the output into firmware if**:
   - No posture triggered the "fewer than 20 labeled readings" warning, and
   - macro-F1 is comfortably high (there's no universal cutoff — but if it's near the "always
     guess the majority class" baseline, the fit isn't telling you anything real; look at the
     confusion matrix, not just the single score).

8. **Re-run after the fact, on real field data, not the tool's own `--self-test`.** That flag only
   proves the fitting code itself is correct against synthetic data — it is explicitly not a
   substitute for this protocol and its output must never be copied into firmware.

## Known limitations of this whole approach

- A single set of thresholds fitted across a few animals in one session/season won't capture
  breed differences (per `docs/Godhan_Vision_Layer_Spec_Analysis.md`'s note on Gir/Sahiwal/Murrah
  buffalo differing from crossbreds) or seasonal coat/behavior drift. Treat this protocol as
  producing a reasonable *starting* calibration, not a one-time fix — plan to repeat it
  periodically, the same "known dataset risk" the vision-layer spec itself calls out for its own
  BCS/dung models (§7.3).
- Collar mounting tightness and position drift over time and between animals will shift the
  effective tilt/magnitude readings for the same true posture. If accuracy degrades in the field
  after a good initial fit, check mounting consistency before assuming the thresholds are wrong.
