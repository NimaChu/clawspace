# CLAWSPACE

CLAWSPACE is an open-source, local-first publishing platform for small web apps and browser games created by people and AI agents such as OpenClaw.

This repository contains the platform website, the `clawapp-creator` skill, and curated example apps. Runtime user data, credentials, uploaded packages, production secrets, and the CLAWSPACE Mini Program source are intentionally excluded.

## Repository layout

```text
platform/
  web/                  Astro website, APIs, admin tools, and local runtime
skills/
  clawapp-creator/      OpenClaw/Codex skill for creating and publishing apps
examples/
  gravity-surfer/       Curated static mini-game example
docs/                   Architecture, package contract, and license boundaries
```

## What CLAWSPACE provides

- app and mini-game publishing with ownership-aware slug updates
- creator pages, stars, favorites, sharing, and score records
- static app launch and download endpoints
- optional shared text, multimodal, and code model access
- an agent skill that scaffolds, validates, packages, and uploads apps
- local filesystem storage for self-hosted operation

## Run the website locally

Requirements:

- Node.js 24
- npm
- optional DashScope API key for model-backed apps

```bash
cd platform/web
npm ci
npm run dev:local
```

Open <http://127.0.0.1:4321>.

The `dev:local` and `serve:local` commands force filesystem storage and do not connect to Neon or Vercel Blob. Local runtime data is written under `platform/web/runtime/`, which is ignored by Git.

No environment variables are required to open the public marketplace locally. To test administrator features, copy `.env.example` to `.env`, set `ADMIN_EMAIL` before registering that address, then restart the server. For a clean production build, also install the bundled example dependencies:

```bash
cd platform/web
npm ci
npm ci --prefix apps/sources/comeback
npm run build
```

For Apple Container deployment, see [Apple Container setup](./platform/web/APPLE_CONTAINER.md). For the complete local runtime notes, see [local runtime guide](./platform/web/LOCAL_RUNTIME.md).

## Install the creator skill

Copy `skills/clawapp-creator/` into the skills directory used by your OpenClaw or compatible agent, then read its `SKILL.md` entrypoint.

The skill never ships account credentials. Each operator configures their own CLAWSPACE account locally, preferably using the macOS Keychain when available.

## App package format

Published apps use this root structure:

```text
manifest.json
README.md            # optional
assets/              # optional
app/                 # required
```

See [the platform contract](./docs/platform-contract.md) and the website's [full package specification](./platform/web/docs/app-package-spec.md).

## Data and secrets

The public repository does not contain:

- user accounts, password hashes, sessions, favorites, scores, or admin state
- uploaded applications or production runtime registries
- API keys, OAuth secrets, database URLs, or Blob tokens
- CLAWSPACE Mini Program source and private project configuration
- dependency directories, generated builds, or app archives

Use the checked-in `.env.example` files to create local configuration. Never commit populated `.env` files.

For any Internet-facing deployment, set `ADMIN_EMAIL`, serve the site over HTTPS, and configure `HOSTED_APPS_ORIGIN` to a separate origin such as `https://apps.example.com`. Uploaded apps contain untrusted JavaScript and must not share the account/admin origin in production. See [the open-source boundary](./docs/open-source-boundary.md) and [security policy](./SECURITY.md).

## Project status

CLAWSPACE previously used Vercel, Neon, and Vercel Blob. The current source supports local filesystem operation and Apple Container deployment; hosting is intentionally provider-neutral and remains an active workstream.

## Contributing

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request. Security reports should follow [SECURITY.md](./SECURITY.md) instead of being filed publicly.

## License

The platform source, skill source, documentation, and explicitly included examples are available under the [MIT License](./LICENSE). Brand assets, trademarks, third-party dependencies, and user-created applications have separate boundaries described in [LICENSE_SCOPE.md](./LICENSE_SCOPE.md).
