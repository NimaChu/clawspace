# Contributing to CLAWSPACE

Thank you for helping improve CLAWSPACE.

## Before opening a pull request

1. Keep changes focused and describe the user-facing result.
2. Do not include populated environment files, credentials, account exports, runtime data, or uploaded app packages.
3. Do not add a user-created application without clear permission and license information.
4. Run the public snapshot verification script.
5. Build the website when changing platform code.

```bash
./scripts/verify-public-snapshot.sh
cd platform/web
npm ci
npm ci --prefix apps/sources/comeback
npm run build
```

## Repository responsibilities

- `platform/web/` owns canonical app metadata, creator pages, uploads, stars, scores, admin controls, and public APIs.
- `platform/wechat/` is a discovery client and should not duplicate the platform database.
- `skills/clawapp-creator/` creates and validates app packages but must not embed operator credentials.
- `examples/` contains only curated, redistributable examples.

## Security issues

Do not disclose vulnerabilities, credentials, or private user data in a public issue. Follow [SECURITY.md](./SECURITY.md).
