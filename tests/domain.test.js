import test from "node:test";
import assert from "node:assert/strict";
import {
  DEVICES,
  LIMITS,
  validateTelemetry,
  assess,
  createDemo,
  toCsv,
} from "../public/domain.js";
const now = 1790899200000;
const sample = (overrides = {}) => ({
  deviceId: "BW-001",
  bootId: "test-boot",
  sequence: 1,
  timestamp: now,
  temperatureC: 35,
  vibrationRms: 0.4,
  ...overrides,
});
test("demo clearly contains four fictional devices with 90 samples", () => {
  const data = createDemo(now);
  assert.equal(Object.keys(data).length, 4);
  assert.equal(data["BW-001"].length, 90);
  assert.equal(data["BW-001"][0].bootId, "demo");
});
test("normal readings stay healthy", () =>
  assert.equal(
    assess([sample(), sample(), sample()], 0.4, now).status,
    "healthy",
  ));
test("single spike does not cause sustained alert", () =>
  assert.equal(
    assess([sample(), sample(), sample({ vibrationRms: 2 })], 0.4, now).status,
    "healthy",
  ));
test("three high samples trigger a vibration alert", () =>
  assert.deepEqual(
    assess(
      Array.from({ length: 3 }, () => sample({ vibrationRms: 2 })),
      0.4,
      now,
    ).reasons,
    ["Sustained high vibration"],
  ));
test("hot samples trigger temperature alert", () =>
  assert.equal(
    assess(
      Array.from({ length: 3 }, () => sample({ temperatureC: 70 })),
      0.4,
      now,
    ).status,
    "attention",
  ));
test("baseline multiplier is honored", () =>
  assert.equal(
    assess(
      Array.from({ length: 3 }, () => sample({ vibrationRms: 1.3 })),
      1,
      now,
    ).status,
    "healthy",
  ));
test("offline and no-data states are distinct", () => {
  assert.equal(assess([], 0.4, now).label, "No data");
  assert.equal(assess([sample()], 0.4, now + 31000).label, "Offline");
});
test("three healthy readings recover after a sustained fault", () =>
  assert.equal(
    assess(
      [
        sample({ vibrationRms: 3 }),
        ...Array.from({ length: 3 }, () => sample()),
      ],
      0.4,
      now,
    ).status,
    "healthy",
  ));
test("valid reading is normalized without extra fields", () =>
  assert.deepEqual(
    validateTelemetry({ ...sample(), secret: "discard" }, now),
    sample(),
  ));
test("rejects invalid, stale and spoofed data", () => {
  for (const x of [
    null,
    [],
    sample({ deviceId: "BAD" }),
    sample({ temperatureC: Infinity }),
    sample({ temperatureC: -99 }),
    sample({ vibrationRms: -1 }),
    sample({ sequence: 1.4 }),
    sample({ timestamp: now - 600000 }),
    sample({ bootId: "<script>" }),
  ])
    assert.throws(() => validateTelemetry(x, now));
});
test("CSV contains source and units, not synthetic live claims", () => {
  const csv = toCsv("BW-001", createDemo(now)["BW-001"]);
  assert.match(csv, /vibration_rms_m_s2/);
  assert.match(csv, /simulated/);
  assert.equal(csv.split("\n").length, 91);
});
