# BenchWatch

An independent equipment-telemetry lab by Arun Pratap Singh Chandel.

**Live demo:** https://benchwatch-arun.arunchandel1780.workers.dev/

**Status: working software prototype with synthetic demo data. Physical hardware validation pending.**
Not affiliated with Arduino, Qualcomm or Edge Impulse. Not a control system, trained AI model, fault diagnosis engine or certified industrial monitor.

## The problem

Campus labs often notice abnormal equipment behavior only when someone reports it. BenchWatch explores a small, reproducible loop: sense temperature and dynamic acceleration, send authenticated feature readings, inspect trends, and record observations. A threshold alert is a reason to investigate, not proof of a mechanical defect.

## What works

- Responsive instrument-style console with four fictional equipment channels.
- Deterministic initial dataset plus synthetic normal, high-vibration, overheating and disconnect scenarios.
- Three-sample threshold persistence, missing-packet detection and labelled CSV export.
- Browser-local demo maintenance notes. Notes do not clear active conditions.
- Protected Cloudflare Worker telemetry ingestion and fleet reads, with D1 storage.
- Device-specific keys, separate operator key, payload validation and replay checks.
- Arduino-compatible ESP32 sensor reference, wiring notes and limitations.
- Automated rule and API guardrail tests.

## What is not validated

The firmware is a reference and has not been compiled/flashed or tested on a physical device in this build. No actual campus installation, measured energy saving, uptime improvement or AI accuracy is claimed. The public demo runs in the browser and never sends its synthetic samples to the production database.

## Local setup

Node.js 22+:

```sh
npm ci
npm test
npm run db:local
npm run dev
```

Open http://localhost:8794. Without credentials, the simulated demo works and real-data endpoints fail closed.

For a local API test, create a git-ignored .dev.vars file:

```text
OPERATOR_KEY="GENERATE_A_RANDOM_32_PLUS_CHARACTER_SECRET"
DEVICE_KEYS_JSON='{"BW-001":"GENERATE_A_DIFFERENT_RANDOM_DEVICE_SECRET"}'
```

Never use the example strings on a public deployment. Read docs/DEPLOYMENT.md before publishing.

## Architecture

```text
ESP32 (Arduino framework)
  ADXL345 -> dynamic acceleration RMS
  DS18B20 -> temperature
      |
      | HTTPS + per-device bearer key
      v
Cloudflare Worker -> validation/replay checks -> D1
      |
      | operator-authenticated /api/fleet
      v
Browser telemetry console
```

The public simulation is a separate browser-only path. Raw accelerometer windows are not uploaded.
Stored live readings retain approximately 24 hours, with cleanup on subsequent ingestion. Reads expose the latest 90 packets per configured node.

## Why these rules?

Thresholds are intentionally visible and interpretable. A single spike does not trigger a sustained alert; three consecutive elevated samples do. Temperature >=60°C, acceleration RMS >=max(1.2 m/s², 2.5× baseline), or no packet for 30 seconds are **illustrative defaults**, not manufacturer specifications. Configure and validate for a real rig.

## Evidence and reproduction

- tests/: software rule and authentication checks.
- docs/HARDWARE.md: wiring, setup and physical experiment.
- docs/DEPLOYMENT.md: Cloudflare/GitHub publication procedure.
- scripts/api-smoke.mjs: isolated local end-to-end API test.
- Use the dashboard to switch faults, review maintenance, export labelled CSV and inspect live/no-data behavior.

## Privacy and limitations

No analytics, camera access, microphone access or third-party AI calls. Google Fonts requests are used for typography; self-host fonts if deployment policy requires it. Real API access is protected by shared operator credentials, not a multi-user login. This is a lab-scale prototype, not a hardened fleet-management platform. Device roster and baselines are defined in source. No remote actuator control is implemented.

## Creator

Arun Pratap Singh Chandel / The Origin Guild
https://arun-chandel-portfolio.pages.dev/

## License

MIT. See LICENSE.
