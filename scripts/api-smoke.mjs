// This script only sends synthetic test packets to the loopback development server.
import assert from "node:assert/strict";
const origin = "http://127.0.0.1:8794";
const operator = "benchwatch-local-test-operator-00000000000000";
const device = "benchwatch-local-test-device-11111111111111";
const bootId = "test-" + Date.now();
const packet = {
  deviceId: "BW-001",
  bootId,
  sequence: 1,
  timestamp: Date.now(),
  temperatureC: 36.2,
  vibrationRms: 0.4,
};
async function post(value, key = device) {
  return fetch(origin + "/api/telemetry", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + key,
    },
    body: JSON.stringify(value),
  });
}
assert.equal((await fetch(origin + "/api/fleet")).status, 401);
assert.equal((await post(packet, "bad-key")).status, 401);
const accepted = await post(packet);
assert.equal(accepted.status, 201, await accepted.text());
assert.equal((await post(packet)).status, 409);
assert.equal((await post({ ...packet, deviceId: "BW-002" })).status, 401);
assert.equal((await post({ ...packet, vibrationRms: -2 })).status, 400);
const fleet = await fetch(origin + "/api/fleet", {
  headers: { Authorization: "Bearer " + operator },
});
assert.equal(fleet.status, 200);
const result = await fleet.json();
assert.ok(result.series["BW-001"].some((s) => s.bootId === bootId));
assert.equal(result.series["BW-001"].at(-1).temperatureC, 36.2);
assert.ok(result.series["BW-001"].every((s) => s.bootId !== "demo"));
console.log(
  "PASS: local D1 ingestion, readback, replay rejection, bounds, device isolation and operator protection.",
);
