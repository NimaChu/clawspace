# First Batch Template Pack

These are the first starter templates designed for CLAWSPACE creators and OpenClaw users.

All game-oriented starters now include a reusable helper at `app/lib/clawspace-game-storage.js`, so creators can persist best scores, best runs, or other lightweight progress with browser storage instead of rewriting localStorage logic each time.

This helper is intentionally optional and genre-aware:

- score chasers can store best score
- puzzle games can store best completion or lowest moves
- story games can store progress or endings if needed

It should support variety, not force every game into the same loop.

## Design goals

- fast to scaffold
- easy to customize
- easy to package and upload
- small enough to stay within the CLAWSPACE static-app model
- clear fit for `none`, `text`, or `multimodal` model categories
- mobile-friendly by default for user-facing front-end apps and games

## Mobile baseline

For this starter pack, assume creators will often preview and share these apps on phones.

Each template should therefore aim for:

- responsive narrow-screen layout
- touch-friendly controls
- no essential hover-only interaction
- a solid first-run experience in portrait mode unless the genre clearly prefers landscape
- for games, a first screen that exposes the core play loop quickly instead of making the player scroll before they can begin
- for game UI, one responsive layout that still feels intentional on both desktop and mobile, rather than a mobile-only or desktop-only composition by accident
- for score-driven games, separate local/account best from platform/global best in the HUD or result layer instead of compressing them into one stat

## Template lineup

## Strong live references

These starters are not the only useful examples anymore. On the live platform, several higher-star apps now act as better quality references:

- `gravity-surfer`
  - reference for score-chasing arcade polish, momentum, and best-score presentation
- `starship-deep-space`
  - reference for mobile-friendly shooter UI and action readability
- `orbit-heist`
  - reference for flagship arcade framing, cover polish, and responsive game composition
- `classic-tank-game`
  - reference for simple controls and familiar action loops that still work well on phones
- `comeback-project`
  - reference for focused AI utility UX
- `online-ocr-tool`
  - reference for multimodal OCR flow and image-analysis product framing

Use these as reality checks when deciding whether a starter still feels too bare.

### 1. `orbit-tap`

Type:

- score-chasing mini-game

Best for:

- first-time creators
- visual remix projects
- brand mini-games

Model category:

- `none`

Why it works:

- tiny surface area
- instantly playable
- easy to reskin

### 2. `memory-flip`

Type:

- puzzle mini-game

Best for:

- themed card games
- educational matching games
- event mini-games

Model category:

- `none`

Why it works:

- familiar gameplay
- easy to reskin with new images or words
- good for low-code creativity

### 3. `focus-timer`

Type:

- lightweight utility app

Best for:

- productivity tools
- creator utilities
- personal dashboards

Model category:

- `none`

Why it works:

- useful beyond gaming
- simple state management
- easy to extend with local persistence or polish

### 4. `ai-rewriter`

Type:

- platform-model text app

Best for:

- writing helpers
- idea generation
- dialogue polishing

Model category:

- `text`

Why it works:

- directly demonstrates CLAWSPACE model integration
- helps creators understand the platform LLM path
- easy to adapt into multiple AI text products

### 5. `ocr-tool`

Type:

- multimodal OCR and image analysis app

Best for:

- OCR tools
- screenshot readers
- chart and receipt analyzers
- image understanding demos

Model category:

- `multimodal`

Why it works:

- demonstrates the platform multimodal API with a real image upload flow
- can be repurposed into many practical AI tools
- includes generated default cover assets when scaffolded, and can be replaced with custom SVG or bitmap art later

## Recommended prompts for OpenClaw

- "帮我用 orbit-tap 模板做一个可上传到 CLAWSPACE 的小游戏。"
- "帮我用 memory-flip 模板做一个校园主题翻牌游戏。"
- "帮我把 focus-timer 模板改成一个番茄钟工具并发布。"
- "帮我用 ai-rewriter 模板做一个文案润色应用，并接入平台模型。"
- "帮我用 ocr-tool 模板做一个可上传到 CLAWSPACE 的图片识别应用。"

## Scaffold examples

```bash
python3 scripts/scaffold_mini_game.py \
  --template orbit-tap \
  --out /path/to/orbit-tap \
  --name "Orbit Tap" \
  --description "点击移动中的星球，45 秒内拿到最高分。"
```

```bash
python3 scripts/scaffold_mini_game.py \
  --template memory-flip \
  --out /path/to/memory-flip \
  --name "Memory Flip" \
  --description "翻开卡片配对，在最短时间内完成整局记忆挑战。"
```

```bash
python3 scripts/scaffold_mini_game.py \
  --template focus-timer \
  --out /path/to/focus-timer \
  --name "Focus Timer" \
  --description "一个轻量专注计时器，帮助你完成一轮深度工作。"
```

```bash
python3 scripts/scaffold_mini_game.py \
  --template ai-rewriter \
  --out /path/to/ai-rewriter \
  --name "AI Rewriter" \
  --description "输入一句草稿，生成更自然的表达版本。"
```

```bash
python3 scripts/scaffold_mini_game.py \
  --template ocr-tool \
  --out /path/to/ocr-tool \
  --name "在线 OCR 工具" \
  --description "上传图片并识别文字、表格或图像内容。"
```
