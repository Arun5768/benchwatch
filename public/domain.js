export const DEVICES = [
  {
    id: "BW-001",
    name: "Extraction fan",
    location: "Fabrication lab / Bay 01",
    short: "Bay 01",
    base: 0.36,
    temp: 36.2,
    baseline: 0.38,
  },
  {
    id: "BW-002",
    name: "Bench drill",
    location: "Fabrication lab / Bay 02",
    short: "Bay 02",
    base: 1.48,
    temp: 48.6,
    baseline: 0.43,
  },
  {
    id: "BW-003",
    name: "Circulation pump",
    location: "Utilities / Bay 03",
    short: "Bay 03",
    base: 0.29,
    temp: 33.8,
    baseline: 0.32,
  },
  {
    id: "BW-004",
    name: "Cooling blower",
    location: "Electronics lab / Bay 04",
    short: "Bay 04",
    base: 0.42,
    temp: 38.1,
    baseline: 0.44,
  },
];
export const LIMITS = Object.freeze({
  temperature: 60,
  vibration: 1.2,
  baselineRatio: 2.5,
  staleMs: 30000,
  consecutive: 3,
});
export function validateTelemetry(x, now = Date.now()) {
  if (!x || typeof x !== "object" || Array.isArray(x))
    throw new Error("Expected a JSON object.");
  if (!DEVICES.some((d) => d.id === x.deviceId))
    throw new Error("Unknown deviceId.");
  if (!Number.isInteger(x.timestamp) || Math.abs(now - x.timestamp) > 300000)
    throw new Error(
      "timestamp must be Unix milliseconds within five minutes of server time.",
    );
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(x.bootId || ""))
    throw new Error("Invalid bootId.");
  if (
    !Number.isInteger(x.sequence) ||
    x.sequence < 0 ||
    x.sequence > 2147483647
  )
    throw new Error("Invalid sequence.");
  if (
    !Number.isFinite(x.temperatureC) ||
    x.temperatureC < -40 ||
    x.temperatureC > 125
  )
    throw new Error("temperatureC must be between -40 and 125.");
  if (
    !Number.isFinite(x.vibrationRms) ||
    x.vibrationRms < 0 ||
    x.vibrationRms > 100
  )
    throw new Error("vibrationRms must be between 0 and 100 m/s².");
  return {
    deviceId: x.deviceId,
    timestamp: x.timestamp,
    bootId: x.bootId,
    sequence: x.sequence,
    temperatureC: x.temperatureC,
    vibrationRms: x.vibrationRms,
  };
}
export function assess(samples, baseline = 0.4, now = Date.now()) {
  if (!samples.length)
    return {
      status: "offline",
      label: "No data",
      reason: "Waiting for a sensor reading.",
      score: null,
      reasons: [],
    };
  const last = samples.at(-1);
  if (now - last.timestamp > LIMITS.staleMs)
    return {
      status: "offline",
      label: "Offline",
      reason: "No new packet for more than 30 seconds.",
      score: null,
      reasons: ["Packet timeout"],
    };
  const tail = samples.slice(-LIMITS.consecutive),
    complete = tail.length === LIMITS.consecutive;
  const heat =
      complete && tail.every((s) => s.temperatureC >= LIMITS.temperature),
    rough =
      complete &&
      tail.every(
        (s) =>
          s.vibrationRms >=
          Math.max(LIMITS.vibration, baseline * LIMITS.baselineRatio),
      );
  const reasons = [
    ...(rough ? ["Sustained high vibration"] : []),
    ...(heat ? ["Sustained high temperature"] : []),
  ];
  const score = Math.round(
    Math.min(
      100,
      Math.max(
        last.vibrationRms /
          Math.max(LIMITS.vibration, baseline * LIMITS.baselineRatio),
        last.temperatureC / LIMITS.temperature,
      ) * 50,
    ),
  );
  return {
    status: reasons.length ? "attention" : "healthy",
    label: reasons.length ? "Needs attention" : "Normal range",
    reason:
      reasons.join(" + ") || "Recent readings are within demo thresholds.",
    score,
    reasons,
  };
}
export function createDemo(now = Date.now()) {
  return Object.fromEntries(
    DEVICES.map((d, j) => [
      d.id,
      Array.from({ length: 90 }, (_, i) => ({
        deviceId: d.id,
        timestamp: now - (89 - i) * 2000,
        temperatureC: +(d.temp + Math.sin(i / 8 + j) * 1.1).toFixed(1),
        vibrationRms: +Math.max(
          0,
          d.base + Math.sin(i * 1.7 + j) * 0.07 + Math.cos(i * 0.8) * 0.04,
        ).toFixed(3),
        sequence: i,
        bootId: "demo",
      })),
    ]),
  );
}
export function toCsv(device, samples) {
  return [
    "device_id,timestamp_utc,temperature_c,vibration_rms_m_s2,source",
    ...samples.map((s) =>
      [
        device,
        new Date(s.timestamp).toISOString(),
        s.temperatureC,
        s.vibrationRms,
        s.bootId === "demo" ? "simulated" : "sensor-api",
      ].join(","),
    ),
  ].join("\n");
}
