# ClawApp Creator

ClawApp Creator is a skill project for OpenClaw / Codex. It helps turn static front-end apps and mini-games into CLAWSPACE-compatible app packages, then uploads them to the production site when the user wants to publish.

It is designed for two common cases:

- Start a small app or mini-game from scratch
- Adapt an existing static front-end project into a platform-ready zip package

Reference platform:

- Website: [https://www.nima-tech.space](https://www.nima-tech.space)
- Skill on ClawHub: [https://clawhub.ai/NimaChu/clawapp-creator](https://clawhub.ai/NimaChu/clawapp-creator)
- Source: [NimaChu/clawspace](https://github.com/NimaChu/clawspace/tree/main/skills/clawapp-creator)

## Monorepo distribution

The public monorepo keeps the skill source under `skills/clawapp-creator/`. The website build creates its downloadable zip from that directory, so the source and hosted package stay aligned without a cross-repository write token.

## Requirements

ClawApp Creator is close to out-of-the-box for most users, because it does not require extra Python packages.

You only need:

- Python `3.9+`
- network access to [https://www.nima-tech.space](https://www.nima-tech.space)
- a browser for local preview flows
- macOS Keychain only if you want the recommended password storage mode

Recommended first check:

```bash
python3 scripts/check_environment.py
```

This verifies:

- Python version
- network access to CLAWSPACE
- browser availability
- Keychain support on macOS
- required skill files

## Progressive Workflow

ClawApp Creator is easiest to use when you think of it as three layers:

1. Main path
   Create or adapt an app, preview it, package it, and publish it.
2. First-time setup
   Register an account, save upload credentials, and confirm which account is active.
3. Extra tools
   Search public apps, download zips, run dry-runs, or optimize images only when needed.

This keeps the default experience light while still leaving the full toolset available.

## What It Does

- Generates a compliant `manifest.json`
- Generates or fills in a `README.md`
- Generates fallback cover assets so creators can still publish even if they do not prepare custom art
- Validates the package structure
- Starts a local preview server before packaging or upload
- Checks risky asset paths
- Checks whether a slug is available
- Searches public apps on CLAWSPACE
- Downloads public CLAWSPACE app zip packages
- Supports dry-run validation before upload
- Supports direct uploads and large-package Blob uploads
- Supports both plaintext config storage and macOS Keychain storage
- Helps choose between `none / text / multimodal / code` model categories
- Includes OCR / image-analysis starter support
- Can generate optional PNG cover assets for existing apps
- Returns detail, launch, download, and share-ready links after upload

## Live Reference Cases

The skill already has starter templates, but the stronger references now come from real CLAWSPACE apps that earned stars on the live platform.

Useful patterns to keep in mind:

- `gravity-surfer`
  - score-driven arcade game
  - strong moment-to-moment feedback
  - works well as a reference for local/account best + global best score loops
- `starship-deep-space`
  - mobile-friendly action shooter
  - good reference for touch-first combat UI that still reads well on desktop
- `orbit-heist`
  - polished HTML5 arcade / stealth structure
  - good reference for a high-polish game loop, cover quality, and responsive playfield framing
- `classic-tank-game`
  - simple action game with broad appeal
  - good reminder that familiar mechanics plus mobile controls can still perform well
- `comeback-project`
  - AI utility with a clear single-purpose workflow
  - good reference for text-model apps that feel practical rather than experimental
- `online-ocr-tool`
  - multimodal OCR tool
  - good reference for image upload flows and correct platform multimodal integration

These should be treated as live reference patterns, not rigid templates.
They are useful for asking: what does a starred CLAWSPACE app usually get right in feedback, polish, input flow, and first-screen clarity?

## Game-Specific Completion Rules

ClawApp Creator now applies an extra layer of guidance only when the user is making a game.
It does not force the same structure onto utilities, visual experiments, or AI tools.

For game projects, it should help OpenClaw think about:

- what kind of game this is
- which lightweight feedback or persistence fits that genre
- what makes the first play session feel complete

Examples:

- arcade games: current score, best score, game-over summary, quick restart
- puzzle games: moves, best completion, solved feedback, reset flow
- story games: chapter progress, ending state, replay path
- sim games: visible resource changes, stage goals, lightweight local persistence

This is meant to improve completion quality without making every CLAWSPACE game feel the same.
It should still leave room for different pacing, framing, and visual style, while nudging game UIs toward something that feels natural on both desktop and phone screens.
For score-driven games, local or account best and platform/global best should stay visibly separate instead of collapsing into one score field.

## Mobile Compatibility

For user-facing apps and mini-games, ClawApp Creator should bias toward mobile-friendly output by default unless the project is clearly desktop-only.

That means:

- responsive layout on narrow screens
- tap-friendly buttons and controls
- no critical hover-only actions
- touch input where it makes sense
- usable portrait layouts unless the concept clearly depends on landscape
- for games and other interactive experiences, the opening mobile view should ideally expose the main action without forcing the user to scroll first
- for games, prefer one responsive UI that works on both mobile and desktop rather than making one side feel like a stretched fallback
- use common tall-phone viewports such as 19.5:9 and 20:9 as practical checks
- for games, budget HUD, playfield, and bottom controls together so the HUD does not accidentally squeeze the game board out of a comfortable mobile view

This matters even more for projects that may later appear in mobile shells such as WeChat Mini Program.

## Main Files

- `SKILL.md`: Main skill instructions
- `scripts/check_environment.py`: Check whether the machine is ready to use the skill
- `scripts/check_clawspace_account.py`: Verify which CLAWSPACE account the current saved config will use
- `scripts/scaffold_mini_game.py`: Generate a mini-game scaffold
- `scripts/generate_app_cover.py`: Generate optional `thumbnail.png` and `icon.png` assets for an existing app
- `scripts/cover_engine.py`: Shared standalone cover engine used by both scaffolding and post-hoc cover generation
- `scripts/build_nima_package.py`: Build a platform zip package
- `scripts/check_game_readiness.py`: Verify game-specific readiness, platform-score wiring, and mobile-first basics
- `scripts/preview_clawspace_app.py`: Start a local preview server for a CLAWSPACE app
- `scripts/register_clawspace_account.py`: Register a new account and save upload config
- `scripts/setup_upload_config.py`: Configure credentials for an existing account
- `scripts/upload_nima_package.py`: Validate and upload a package
- `references/platform-contract.md`: Packaging rules
- `references/model-api.md`: Platform model API guide

## Main Path

Most users should start here:

1. Create or adapt the app
2. Preview locally
3. Build the package
4. Upload

### 0. Optional environment check

```bash
python3 scripts/check_environment.py
```

If this reports warnings, fix those first. It is the fastest way to confirm whether the skill is ready to run on a new machine.

### 1. Create a new mini-game

```bash
python3 scripts/scaffold_mini_game.py \
  --name "Orbit Tap" \
  --description "A lightweight game about tapping planets on an orbit."
```

If you skip `--out`, ClawApp Creator now creates the project in the default OpenClaw workspace:

```text
~/.openclaw/workspace/projects/apps/<slug>
```

Every scaffold now includes default cover assets:

- `assets/thumbnail.png`
- `assets/icon.png`

These generated covers are now split into stable per-app variants based on the slug, and the cover engine now uses broader motif detection for editors, planners, calculators, rhythm tools, shooters, story pieces, and education apps.
That makes generated covers noticeably less samey than the earlier single-track defaults.

You can keep the generated assets or replace them later with your own PNG, JPG, WebP, or SVG cover art.
The scaffold no longer duplicates the same image into `screenshots` by default, which keeps starter packages lighter.
Game starters also include a reusable local progress helper at `app/lib/clawspace-game-storage.js`, so mini-games can persist best scores or best runs with browser storage out of the box.
For game projects, prefer that helper over ad-hoc localStorage keys, so score and progress storage stays predictable and reusable.
When the player is logged into CLAWSPACE, that helper can also sync a personal best score and read the global best score from the site API.
For score-driven games, show those values separately: local/account best is not the same thing as the platform global best.
For mobile shells such as WeChat Mini Program, PNG/JPG/WebP is recommended. If creators only provide SVG or skip custom art entirely, CLAWSPACE can fall back to default mobile-safe PNG covers.

### 1c. Generate a fallback PNG cover for an existing app

Use this only when the app has no custom art yet and still needs a publishable fallback listing image.
It is not the recommended path for high-polish custom cover design.

```bash
python3 scripts/generate_app_cover.py /path/to/project
```

This generates:

- `assets/thumbnail.png`
- `assets/icon.png`

The generated cover is deterministic for that app slug, but it no longer depends on the scaffold template path.
It can run directly against an existing CLAWSPACE app project with a `manifest.json`.
It also uses more built-in motif families and more stable variants, so similar apps are much less likely to collapse into the exact same generated image.

And updates `manifest.json` to point at those files when the manifest lives at the project root.

Treat this output as a fallback cover, not as the final ideal art direction for the app.
If the project matters visually, the better path is for the agent to read the app name, description, tags, genre, and interaction model, then design a custom cover around the actual content.
For a more custom high-polish cover, use an installed cover-generation skill or another explicit content-driven design step, then replace `assets/thumbnail.png`.

As a practical decision rule:

- use the fallback generator only when the app has no cover and just needs a safe publishable listing image
- switch to a content-driven cover pass when the user cares about branding, originality, or first impressions
- switch to a content-driven cover pass when the app is meant to feel distinctive in sharing, screenshots, public demos, or other presentation-heavy contexts
- switch to a content-driven cover pass when the app's real hook is specific enough that a generic category image would feel misleading
- switch to a content-driven cover pass when the fallback art does not communicate the actual gameplay loop, tool surface, or mood

In that stronger path, the agent should read the app's actual concept first and design around what makes this specific project memorable, instead of relying on generic motif rules alone.

### 1b. Scaffold an OCR / multimodal app

```bash
python3 scripts/scaffold_mini_game.py \
  --template ocr-tool \
  --name "Online OCR Tool" \
  --description "Upload an image and extract text, tables, or visual content."
```

This makes the default project storage path predictable for OpenClaw users:

- all generated projects go under `~/.openclaw/workspace/projects/apps/`
- each app gets its own folder named by slug
- packaged zips and local preview flows can reuse that same folder directly

### 2. Preview locally

```bash
python3 scripts/preview_clawspace_app.py /path/to/project --open
```

This starts a lightweight local static server, prints the preview URL, and can open the app in your browser automatically.

### 3. Build a package

```bash
python3 scripts/build_nima_package.py \
  --app-dir /path/to/app \
  --manifest /path/to/manifest.json \
  --out /path/to/output.zip \
  --readme /path/to/README.md \
  --assets-dir /path/to/assets
```

During build, ClawApp Creator now also checks cover and screenshot assets for:

- zero-byte files
- oversized icon / thumbnail / screenshot images
- SVG-only thumbnail setups that may need a mobile fallback

For game-specific readiness checks, use:

```bash
python3 scripts/check_game_readiness.py \
  --html /path/to/app/index.html \
  --js /path/to/app/main.js \
  --css /path/to/app/styles.css
```

This is especially useful for score-driven games because it checks for:

- local best display
- platform/global best display
- `/api/game-scores` wiring
- touch or pointer interaction
- end-state / replay flow
- viewport and mobile-height hints
- optional testing hooks like `window.render_game_to_text` and `window.advanceTime(ms)`

### 4. Upload

```bash
python3 scripts/upload_nima_package.py \
  --package /path/to/output.zip \
  --model-category none
```

If upload reaches the Blob step but then fails with a non-JSON error, the script now prints:

- HTTP status
- response content type
- a short response snippet

That usually means the CLAWSPACE import finalize step returned an HTML error page (for example a timeout or platform error), not that your account credentials were wrong.
For packages near the upload threshold, ClawApp Creator now also falls back automatically:

- it tries direct upload first for smaller packages
- if direct upload fails or returns a non-JSON response, it automatically retries with Blob upload
- larger packages still go to Blob first

This keeps creators from having to manually guess which upload path will behave better.

## First-Time Setup

Use this section only when the user has no CLAWSPACE account yet, or wants to change which account the uploader uses.

If you prefer to register manually, you can do that first on the website:

- [https://www.nima-tech.space/register](https://www.nima-tech.space/register)

### 1. Register a new CLAWSPACE account

```bash
python3 scripts/register_clawspace_account.py
```

This creates the account and saves reusable upload credentials in one step.

Recommended first-time options:

- Let ClawApp Creator register the account and save the upload config for you
- Or register manually first at [https://www.nima-tech.space/register](https://www.nima-tech.space/register)

Non-interactive example:

```bash
python3 scripts/register_clawspace_account.py \
  --site-url https://www.nima-tech.space \
  --display-name "Your Name" \
  --email you@example.com \
  --password 'your-password' \
  --password-store keychain \
  --non-interactive
```

### 2. Configure upload credentials for an existing account

```bash
python3 scripts/setup_upload_config.py
```

On macOS you can choose Keychain storage instead of storing the password in plaintext config.

Default production site:

```text
https://www.nima-tech.space
```

### 3. Check which account is currently configured

```bash
python3 scripts/check_clawspace_account.py
```

Use this before upload if you want to confirm which CLAWSPACE account the current config is bound to.

## Extra Tools

Use these only when the task really needs them.

### 1. Dry-run before upload

```bash
python3 scripts/upload_nima_package.py \
  --package /path/to/output.zip \
  --dry-run
```

If your package has oversized PNG/JPG/WebP cover art, the script now warns before upload.
It also blocks obviously broken assets such as zero-byte screenshots.

On macOS you can ask the uploader to build an optimized copy first:

```bash
python3 scripts/upload_nima_package.py \
  --package /path/to/output.zip \
  --model-category none \
  --optimize-images
```

That is especially useful when a package contains very large `thumbnail.png` or `icon.png` files that can make the server-side import finalize step fail.

### 2. Search public apps on CLAWSPACE

```bash
python3 scripts/search_clawspace_apps.py "ocr"
```

### 3. Download a public app package

```bash
python3 scripts/download_clawspace_app.py orbit-heist --out-dir /path/to/downloads
```

## Publish Mode Prompts

These direct prompts work well in OpenClaw:

- `Help me make a mini-game that can be uploaded to CLAWSPACE`
- `Turn this project into a publishable CLAWSPACE app`
- `Help me publish this app directly`

In publish mode, the skill should diagnose, package, verify slug ownership, upload, and return the final links.

## Supported Templates

- `starter-mini-game`
- `starter-ocr`
- `starter-memory-flip`
- `starter-focus-timer`
- `starter-ai-rewriter`

## Notes

- The target platform currently supports static front-end apps and mini-games.
- No extra Python packages are required; the scripts use the standard library.
- The final zip should stay within `25MB`.
- The same account can overwrite its own slug.
- Different accounts cannot overwrite each other's slug.
- New users can register directly through `scripts/register_clawspace_account.py`.
- Existing users should use `scripts/setup_upload_config.py` instead of registering again.
- Public search and download use the production site at `https://www.nima-tech.space`.
- Local preview reads `manifest.json` and serves the project root directly.
- If ClawHub is rate limited, users can still install the skill from GitHub.
- macOS users get the smoothest credential flow because Keychain storage is supported directly.

## Security Notes

- The skill can register, log in, and upload on the user's behalf, so it should be treated as a publishing tool with account-level permissions.
- On macOS, `keychain` is the recommended password storage mode.
- `config` plaintext password storage is kept only as a compatibility fallback.
- Before upload, creators can run `python3 scripts/check_clawspace_account.py` to confirm which account is currently active.
- `upload_nima_package.py` now prints the active account summary before it uploads anything.

## Repository Role

This repository is the source of the `clawapp-creator` skill and can also be installed directly into Codex skills directories.
