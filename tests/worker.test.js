import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/worker.js";
const req = (path, opts = {}) =>
  new Request("https://benchwatch.test" + path, opts);
test("public health never claims physical hardware validation", async () => {
  const r = await worker.fetch(req("/api/health"), {});
  const x = await r.json();
  assert.equal(x.liveConfigured, false);
  assert.equal(x.demo, "client-side synthetic data");
});
test("unconfigured ingestion fails closed", async () =>
  assert.equal(
    (await worker.fetch(req("/api/telemetry", { method: "POST" }), {})).status,
    503,
  ));
test("operator key is needed for fleet data", async () =>
  assert.equal(
    (
      await worker.fetch(req("/api/fleet"), {
        DB: {},
        OPERATOR_KEY: "a".repeat(32),
      })
    ).status,
    401,
  ));
test("device key cannot read private fleet", async () =>
  assert.equal(
    (
      await worker.fetch(
        req("/api/fleet", {
          headers: { Authorization: "Bearer " + "b".repeat(32) },
        }),
        { DB: {}, OPERATOR_KEY: "a".repeat(32) },
      )
    ).status,
    401,
  ));
test("rejects incorrect content type", async () =>
  assert.equal(
    (
      await worker.fetch(req("/api/telemetry", { method: "POST", body: "x" }), {
        DB: {},
        DEVICE_KEYS_JSON: "{}",
      })
    ).status,
    415,
  ));
test("rejects invalid telemetry before writing", async () =>
  assert.equal(
    (
      await worker.fetch(
        req("/api/telemetry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        }),
        { DB: {}, DEVICE_KEYS_JSON: "{}" },
      )
    ).status,
    400,
  ));
test("rejects missing device key", async () => {
  const body = JSON.stringify({
    deviceId: "BW-001",
    bootId: "test",
    sequence: 1,
    timestamp: Date.now(),
    temperatureC: 35,
    vibrationRms: 0.4,
  });
  assert.equal(
    (
      await worker.fetch(
        req("/api/telemetry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        }),
        {
          DB: {},
          DEVICE_KEYS_JSON: JSON.stringify({ "BW-001": "x".repeat(32) }),
        },
      )
    ).status,
    401,
  );
});
