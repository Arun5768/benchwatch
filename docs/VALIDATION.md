# Validation record

## Software checks completed locally

- 18 Node.js tests: threshold persistence, recovery, missing data, validation, CSV labelling and API authentication guardrails.
- Compiled C++ feature tests: empty window, stationary gravity removal, known alternating signal and three-axis energy.
- Local Cloudflare D1 smoke test: successful authenticated ingestion/readback, replay rejection, wrong-key/device isolation, invalid bounds and protected operator access.
- Cloudflare Worker deployment dry run completed. This does not constitute a public deployment.
- Browser checks: normal, sustained vibration, overheating and packet-loss scenarios; device selection; maintenance-note persistence; pause/resume; desktop and 390px mobile layout with no page-wide horizontal overflow.
- CSV content generation is unit-tested. The interface also provides a selectable CSV preview because embedded browsers may block downloads. Actual download behavior depends on the browser.

## Published deployment checks - 2 October 2026

- Cloudflare Worker and D1 database deployed after project-owner approval.
- Public site and health endpoint return HTTP 200; production authentication is configured.
- Unauthenticated fleet reads and device keys used as operator keys return HTTP 401.
- Invalid readings return HTTP 400 and a device key used for another device returns HTTP 401.
- Authorized fleet reads return four empty channels. No synthetic test readings were stored in production.
- Production keys were generated independently of local test fixtures and are excluded from Git.

## Hardware boundaries

- No physical equipment or sensor was connected.
- The complete Arduino sketch was not compiled or flashed; only its standalone feature calculation was compiled and tested.
- No Edge Impulse model or Qualcomm hardware execution is claimed.
- The known credentials in scripts/api-smoke.mjs are localhost-only test fixtures. Never provision these on Cloudflare.

## Repeat locally

Run npm ci, npm test, npm run db:local and npm run dev. The API smoke script expects the isolated local test keys described in that script, in an ignored .dev.vars file. Then run node scripts/api-smoke.mjs.

For the independent C++ tests, with GCC installed: g++ -std=c++11 tests/features_test.cpp -o output/features_test.exe, then execute that file. Create the ignored output directory first.
