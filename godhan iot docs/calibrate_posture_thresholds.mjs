#!/usr/bin/env node
// =======================================================
// Posture threshold calibration tool
//
// Fits classifyPosture()'s three thresholds (POSTURE_WALK_MAG_THRESH_G,
// POSTURE_GRAZING_TILT_DEG, POSTURE_LYING_ACCZ_THRESH_G — see
// esp_32_firmware_skeleton.cpp) against real labeled accelerometer readings via grid search,
// instead of the current values, which were carried over from an unused, never-validated project
// (docs/olddocs chatgpt/CattleCare_All_Documents/cattle_firmware/) with no field data behind them
// either. There is no portable literature threshold to substitute in for a neck-collar mounting —
// published cattle work either uses leg-mounted tilt sensors (different geometry entirely) or
// trains a classifier on labeled data, which is exactly what this tool does once that data exists.
//
// Usage:
//   node calibrate_posture_thresholds.mjs <labeled-readings.csv>
//   node calibrate_posture_thresholds.mjs --self-test
//
// Input CSV format (header required): timestamp,accX,accY,accZ,label
//   accX/accY/accZ in g (same units classifyPosture() expects — if you're exporting raw
//   sensor_data documents, note those are logged in m/s^2 from Adafruit_MPU6050; divide by
//   9.80665 first, same conversion classifyPosture() itself does).
//   label is one of: standing | lying | walking | grazing
// See POSTURE_CALIBRATION_PROTOCOL.md for how to actually produce this file in the field.
//
// --self-test generates synthetic labeled data from a hand-written physical model of each
// posture and runs the same fitting procedure against it. This only proves the fitting code
// itself works (search converges, confusion matrix math is right) — it is NOT a real calibration
// result and must never be copied into firmware. Real thresholds only come from real animals.
// =======================================================

import { readFileSync } from "fs";

const POSTURES = ["standing", "lying", "walking", "grazing"];

function classify(accX, accY, accZ, walkThreshG, grazingTiltDeg, lyingAccZThreshG) {
  const magnitude = Math.sqrt(accX * accX + accY * accY + accZ * accZ);
  const tiltDeg = Math.atan2(accX, accZ) * (180 / Math.PI);
  // Same precedence order as classifyPosture() in esp_32_firmware_skeleton.cpp — must be kept in
  // sync by hand; there's only one copy of this logic in C++ and this is its JS mirror.
  if (magnitude > walkThreshG) return "walking";
  if (tiltDeg < grazingTiltDeg) return "grazing";
  if (Math.abs(accZ) < lyingAccZThreshG) return "lying";
  return "standing";
}

function parseCsv(text) {
  const lines = text.trim().split("\n");
  const header = lines[0].split(",").map((h) => h.trim());
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));
  for (const col of ["accX", "accY", "accZ", "label"]) {
    if (!(col in idx)) throw new Error(`CSV missing required column "${col}"`);
  }
  return lines.slice(1).filter(Boolean).map((line) => {
    const cells = line.split(",");
    const label = cells[idx.label].trim();
    if (!POSTURES.includes(label)) {
      throw new Error(`Unrecognised label "${label}" — must be one of ${POSTURES.join("|")}`);
    }
    return {
      accX: parseFloat(cells[idx.accX]),
      accY: parseFloat(cells[idx.accY]),
      accZ: parseFloat(cells[idx.accZ]),
      label,
    };
  });
}

function confusionMatrix(readings, params) {
  const matrix = {};
  for (const truth of POSTURES) {
    matrix[truth] = {};
    for (const pred of POSTURES) matrix[truth][pred] = 0;
  }
  for (const r of readings) {
    const predicted = classify(r.accX, r.accY, r.accZ, ...params);
    matrix[r.label][predicted]++;
  }
  return matrix;
}

// Macro-F1 (average of per-class F1) rather than raw accuracy — the calibration data will
// realistically be dominated by "standing", and a metric that lets the fitter ignore rare
// classes (lying, walking, grazing) entirely to chase overall accuracy would defeat the purpose
// of calibrating those thresholds at all.
function macroF1(matrix) {
  let total = 0;
  for (const cls of POSTURES) {
    const tp = matrix[cls][cls];
    const predictedPositive = POSTURES.reduce((sum, truth) => sum + matrix[truth][cls], 0);
    const actualPositive = POSTURES.reduce((sum, pred) => sum + matrix[cls][pred], 0);
    const precision = predictedPositive > 0 ? tp / predictedPositive : 0;
    const recall = actualPositive > 0 ? tp / actualPositive : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    total += f1;
  }
  return total / POSTURES.length;
}

function gridSearch(readings) {
  // Ranges centred on the current unvalidated defaults (see esp_32_firmware_skeleton.cpp),
  // widened enough either side that the fit isn't artificially pinned near them.
  const walkRange = range(1.10, 1.60, 0.05);
  const tiltRange = range(-40, -10, 2);
  const lyingRange = range(0.05, 0.50, 0.025);

  let best = null;
  for (const w of walkRange) {
    for (const t of tiltRange) {
      for (const l of lyingRange) {
        const matrix = confusionMatrix(readings, [w, t, l]);
        const score = macroF1(matrix);
        if (!best || score > best.score) best = { score, params: [w, t, l], matrix };
      }
    }
  }
  return best;
}

function range(start, end, step) {
  const out = [];
  for (let v = start; v <= end + 1e-9; v += step) out.push(Number(v.toFixed(4)));
  return out;
}

function printConfusionMatrix(matrix) {
  const colWidth = 10;
  const pad = (s) => String(s).padEnd(colWidth);
  console.log(pad("truth\\pred") + POSTURES.map(pad).join(""));
  for (const truth of POSTURES) {
    console.log(pad(truth) + POSTURES.map((pred) => pad(matrix[truth][pred])).join(""));
  }
}

function generateSelfTestData() {
  // Hand-written physical model, NOT real animal data — see the module comment. Each posture
  // gets a plausible gravity-vector orientation plus Gaussian-ish noise via averaged uniform
  // draws, so the fitter has something realistically messy (not a trivially separable toy set)
  // to prove the search machinery works before anyone trusts it with real labels.
  function noise(scale) {
    return (Math.random() + Math.random() + Math.random() - 1.5) * scale;
  }
  const rows = [];
  const perClass = 300;
  for (let i = 0; i < perClass; i++) {
    // Standing: roughly upright, accZ near +1g, small X/Y.
    rows.push({ accX: 0 + noise(0.15), accY: 0 + noise(0.15), accZ: 1.0 + noise(0.1), label: "standing" });
    // Lying: collar rotates toward horizontal, accZ near 0.
    rows.push({ accX: 0.3 + noise(0.2), accY: 0 + noise(0.2), accZ: 0.05 + noise(0.15), label: "lying" });
    // Walking: same rough orientation as standing but with much higher magnitude from motion.
    rows.push({ accX: 0.6 + noise(0.3), accY: 0.4 + noise(0.3), accZ: 1.0 + noise(0.3), label: "walking" });
    // Grazing: head/neck down, so accX picks up a large component relative to accZ (steep tilt).
    rows.push({ accX: -0.8 + noise(0.15), accY: 0 + noise(0.15), accZ: 0.5 + noise(0.15), label: "grazing" });
  }
  return rows;
}

function main() {
  const arg = process.argv[2];
  let readings;
  let selfTest = false;

  if (arg === "--self-test") {
    selfTest = true;
    readings = generateSelfTestData();
    console.log(`[self-test] generated ${readings.length} synthetic labeled readings — this validates the fitting code only, NOT real thresholds.\n`);
  } else if (arg) {
    readings = parseCsv(readFileSync(arg, "utf8"));
    console.log(`Loaded ${readings.length} labeled readings from ${arg}\n`);
  } else {
    console.error("Usage: node calibrate_posture_thresholds.mjs <labeled-readings.csv>\n       node calibrate_posture_thresholds.mjs --self-test");
    process.exit(1);
  }

  const counts = Object.fromEntries(POSTURES.map((p) => [p, 0]));
  for (const r of readings) counts[r.label]++;
  console.log("Label distribution:", counts);
  const sparse = POSTURES.filter((p) => counts[p] < 20);
  if (sparse.length > 0) {
    console.warn(`\nWARNING: fewer than 20 labeled readings for [${sparse.join(", ")}] — the fitted threshold(s) touching those classes should not be trusted yet. Collect more labeled data for them before relying on this result.\n`);
  }

  const best = gridSearch(readings);
  const [walk, tilt, lying] = best.params;

  console.log(`\nBest fit (macro-F1 = ${best.score.toFixed(3)}):`);
  console.log(`  POSTURE_WALK_MAG_THRESH_G   = ${walk}f`);
  console.log(`  POSTURE_GRAZING_TILT_DEG    = ${tilt}f`);
  console.log(`  POSTURE_LYING_ACCZ_THRESH_G = ${lying}f`);
  console.log("\nConfusion matrix (rows = truth, cols = predicted):");
  printConfusionMatrix(best.matrix);

  if (selfTest) {
    console.log("\nThis was --self-test synthetic data. Do NOT paste the numbers above into firmware — run this tool against a real labeled-readings.csv (see POSTURE_CALIBRATION_PROTOCOL.md) to get real thresholds.");
  } else {
    console.log("\nIf macro-F1 is comfortably high and no class was flagged sparse above, these values are ready to paste into esp_32_firmware_skeleton.cpp's POSTURE_* defines.");
  }
}

main();
