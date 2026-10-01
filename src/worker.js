import { DEVICES, validateTelemetry, assess } from "../public/domain.js";
const headers = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};
const json = (body, status = 200) => Response.json(body, { status, headers });
async function equalSecret(a, b) {
  if (
    typeof a !== "string" ||
    typeof b !== "string" ||
    b.length < 24 ||
    a.length > 256
  )
    return false;
  const enc = new TextEncoder(),
    ha = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(a))),
    hb = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(b)));
  let diff = 0;
  for (let i = 0; i < ha.length; i++) diff |= ha[i] ^ hb[i];
  return diff === 0;
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url),
      path = url.pathname,
      bearer =
        request.headers.get("Authorization")?.replace(/^Bearer /, "") || "";
    if (!path.startsWith("/api/")) return env.ASSETS.fetch(request);
    if (path === "/api/health" && request.method === "GET")
      return json({
        service: "benchwatch",
        status: "ok",
        version: "0.1.0",
        demo: "client-side synthetic data",
        liveConfigured: Boolean(
          env.DB && env.OPERATOR_KEY && env.DEVICE_KEYS_JSON,
        ),
      });
    if (path === "/api/telemetry" && request.method === "POST") {
      if (!env.DB || !env.DEVICE_KEYS_JSON)
        return json(
          {
            error:
              "Sensor ingestion is not configured. Provision the database and per-device keys.",
          },
          503,
        );
      if (!request.headers.get("Content-Type")?.includes("application/json"))
        return json({ error: "Use application/json." }, 415);
      if (Number(request.headers.get("Content-Length")) > 4096)
        return json({ error: "Payload too large." }, 413);
      let payload;
      try {
        const text = await request.text();
        if (text.length > 4096)
          return json({ error: "Payload too large." }, 413);
        payload = validateTelemetry(JSON.parse(text));
      } catch (e) {
        return json({ error: e.message }, 400);
      }
      let keys;
      try {
        keys = JSON.parse(env.DEVICE_KEYS_JSON);
      } catch {
        return json(
          { error: "Device authentication configuration is invalid." },
          503,
        );
      }
      if (!(await equalSecret(bearer, keys[payload.deviceId])))
        return json({ error: "Invalid device credentials." }, 401);
      try {
        const cutoff = Date.now() - 86400000;
        const recent = await env.DB.prepare(
          "SELECT timestamp FROM readings WHERE device_id=? ORDER BY timestamp DESC LIMIT 1",
        )
          .bind(payload.deviceId)
          .first();
        if (recent && payload.timestamp <= recent.timestamp)
          return json(
            { error: "Reading is older than the latest accepted packet." },
            409,
          );
        if (recent && Date.now() - recent.timestamp < 1000)
          return json(
            { error: "Wait at least one second between packets." },
            429,
          );
        const result = await env.DB.prepare(
          "INSERT OR IGNORE INTO readings (device_id,boot_id,sequence,timestamp,temperature_c,vibration_rms) VALUES (?,?,?,?,?,?)",
        )
          .bind(
            payload.deviceId,
            payload.bootId,
            payload.sequence,
            payload.timestamp,
            payload.temperatureC,
            payload.vibrationRms,
          )
          .run();
        if (result.meta.changes === 0)
          return json({ error: "Duplicate packet or replayed sequence." }, 409);
        await env.DB.prepare("DELETE FROM readings WHERE timestamp < ?")
          .bind(cutoff)
          .run();
        return json({ accepted: true, deviceId: payload.deviceId }, 201);
      } catch {
        return json(
          {
            error: "Telemetry storage unavailable. Check database migrations.",
          },
          503,
        );
      }
    }
    if (path === "/api/fleet" && request.method === "GET") {
      if (!env.OPERATOR_KEY || !env.DB)
        return json(
          {
            error:
              "Live mode is not configured. The public simulation remains available.",
          },
          503,
        );
      if (!(await equalSecret(bearer, env.OPERATOR_KEY)))
        return json({ error: "Invalid operator key." }, 401);
      try {
        const series = {},
          devices = [];
        for (const d of DEVICES) {
          const { results } = await env.DB.prepare(
            "SELECT timestamp,temperature_c AS temperatureC,vibration_rms AS vibrationRms,sequence,boot_id AS bootId FROM readings WHERE device_id=? ORDER BY timestamp DESC LIMIT 90",
          )
            .bind(d.id)
            .all();
          series[d.id] = results
            .reverse()
            .map((x) => ({ ...x, deviceId: d.id }));
          devices.push({ ...d, state: assess(series[d.id], d.baseline) });
        }
        return json({
          series,
          devices,
          source: "sensor-api",
          baseline: "illustrative; calibration required",
        });
      } catch {
        return json(
          { error: "Could not read telemetry. Check database migrations." },
          503,
        );
      }
    }
    return json({ error: "Not found or unsupported method." }, 404);
  },
};
