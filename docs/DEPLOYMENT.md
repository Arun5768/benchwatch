# Publishing BenchWatch

## Review gate

Do not publish until the project owner has reviewed and explicitly approved the finished app and source. No GitHub repository or Cloudflare deployment is created merely by running local checks.

## Preparation

1. Run npm ci, npm test and npm run check.
2. Inspect firmware/secrets.h, .dev.vars and all environment files: they must stay ignored.
3. Choose the final repository visibility and deployment name.
4. The checked-in D1 ID belongs to the original BenchWatch deployment. Create your own database and replace this ID when deploying a fork. The ID is not an authentication credential.

## Cloudflare

After owner approval:

```sh
npx wrangler login
npx wrangler d1 create benchwatch-db
```

Replace only database_id in wrangler.jsonc with the returned value.

```sh
npx wrangler d1 migrations apply DB --config wrangler.jsonc --remote
npx wrangler secret put OPERATOR_KEY --config wrangler.jsonc
npx wrangler secret put DEVICE_KEYS_JSON --config wrangler.jsonc
npm run deploy
```

Use cryptographically random secrets (at least 32 random bytes encoded as hex). DEVICE_KEYS_JSON maps a configured node ID to a unique per-device key. The operator key must be different. Never put production secrets in source, screenshots, URLs or frontend code.

The public site serves a simulation by default. Without configured secrets, live endpoints return 503; this is intentional. Cloudflare charges and account limits are the owner's responsibility. No paid services are automatically purchased.

## GitHub

Create a standalone repository only for this benchwatch directory, not its parent workspace. Review the file list and git diff before committing and pushing. Include source, tests, lockfile, firmware reference and documentation. Exclude .wrangler, .build, node_modules, output and all secrets.

## Post-deploy checks

- Public demo renders, all controls work, mobile layout is usable.
- Unauthorized fleet reads return 401 (or 503 when unconfigured).
- A device key writes only for its bound device and cannot read fleet data.
- Malformed or stale readings are rejected.
- Duplicate/replayed sequences are rejected.
- A valid packet appears only in protected live mode.
- Confirm database retention, quota monitoring and secret rotation before any real deployment.

## Prototype boundaries

A per-device one-second guard is a basic application check, not a distributed rate limiter. Add platform rate limiting before accepting untrusted internet-scale traffic. The roster and thresholds are source-configured; no dynamic provisioning UI exists. Add per-user authentication, audit logging and field calibration before production use.
