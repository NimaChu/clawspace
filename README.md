# CLAWSPACE

CLAWSPACE is a universe for playful imagination.

It is a public home for open-source web apps and mini-games made by humans, and made easier with OpenClaw.

[Visit the website](https://www.nima-tech.space)

## What CLAWSPACE is

CLAWSPACE is a place where creators can:

- upload static front-end apps and mini-games
- launch and play them directly in the browser
- download app packages from the site
- share their creator page and build a body of work
- optionally connect to the platform model API for free shared AI access

This is not just a gallery. It is a publishable app space.

## Who it is for

CLAWSPACE is designed for:

- OpenClaw users who want to turn ideas into apps quickly
- indie makers building small interactive tools or games
- creators who want a lightweight way to publish browser experiences
- people who want to explore playful, experimental, open-source projects

## Website

- 🌐 Website: [https://www.nima-tech.space](https://www.nima-tech.space)
- 🪐 App atlas: [https://www.nima-tech.space/#apps](https://www.nima-tech.space/#apps)
- 🏆 Creator ranking: [https://www.nima-tech.space/creators](https://www.nima-tech.space/creators)
- 📦 Upload page: [https://www.nima-tech.space/admin/import](https://www.nima-tech.space/admin/import)

## How publishing works

1. Build a static front-end app or mini-game.
2. Package it into the CLAWSPACE upload format.
3. Log in on the site.
4. Upload the zip package.
5. The app gets a detail page, launch page, and downloadable package link.

## Package format

Each app package is a zip file with this root structure:

```text
manifest.json
README.md            # optional
assets/              # optional
app/                 # required
```

Minimum `manifest.json` example:

```json
{
  "schemaVersion": 1,
  "id": "orbit-tap",
  "slug": "orbit-tap",
  "name": "Orbit Tap",
  "description": "A lightweight browser mini-game.",
  "version": "1.0.0",
  "modelCategory": "none",
  "entry": "app/index.html"
}
```

Notes:

- Only static front-end apps and mini-games are supported.
- The entry file must stay inside `app/`.
- The zip should stay at or under `25MB`.
- The same user can upload the same slug again to update their app.
- A different user cannot overwrite an existing slug owned by someone else.

More details:

- 📘 [Platform contract](./docs/platform-contract.md)
- 🤖 [Model API guide](./docs/model-api.md)

## OpenClaw workflow

If you use OpenClaw, the easiest way to create and publish apps for CLAWSPACE is the `clawapp-creator` skill.

Recommended install route:

- ⚡ [ClawHub: NimaChu/clawapp-creator](https://clawhub.ai/NimaChu/clawapp-creator)

Fallback install route:

- 🧰 [GitHub: NimaChu/clawapp-creator](https://github.com/NimaChu/clawapp-creator)

You can copy this sentence directly into OpenClaw:

```text
Please install the skill named clawapp-creator from https://clawhub.ai/NimaChu/clawapp-creator . If ClawHub is rate limited, fall back to the GitHub repository NimaChu/clawapp-creator.
```

What the skill helps with:

- scaffold a new mini-game
- scaffold OCR and multimodal app starters
- adapt an existing static app
- generate a compliant manifest
- package the app as a zip
- validate slug ownership
- upload the package to CLAWSPACE

Skill repository:

- [NimaChu/clawapp-creator](https://github.com/NimaChu/clawapp-creator)

## Platform model support

Apps that need AI can use the platform model API instead of embedding their own client-side API keys.

Supported model categories:

- `none`
- `text`
- `multimodal`
- `code`

If the app does not need AI, keep `modelCategory` as `none`.

## Example apps

- 🔁 [Comeback](https://www.nima-tech.space/apps/comeback-project)
- 🧩 [Tetris Orbit](https://www.nima-tech.space/apps/tetris-orbit)
- 🦞 [Lobster Factory](https://www.nima-tech.space/apps/lobster-factory)

## What creators can build

Great fits for CLAWSPACE include:

- lightweight browser games
- playful utilities and toy tools
- OCR and image-analysis apps using the platform multimodal model
- text and code helpers that use the shared model API
- experimental interactive demos that are easy to launch and share

## Why this repo exists

This repository is the public home of CLAWSPACE.

It exists to:

- explain what the platform is
- document the upload format
- help creators publish apps and games
- provide a shareable GitHub project people can follow and star

The production website code is not hosted in this public repository.

## Community

If you want to suggest ideas for the platform, improve docs, or request publishing features, open an issue in this repository.

## License

[MIT](./LICENSE)
