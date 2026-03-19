# CLAWSPACE Platform Contract

## Production site

- Public website: `https://www.nima-tech.space`
- API base URL: `https://www.nima-tech.space`

## Supported app type

- Only static front-end apps and mini-games are supported.
- Packages must be self-contained.
- A separate backend is not required for the first version.

## Required package structure

```text
manifest.json
README.md            # optional
assets/              # optional
app/                 # required
```

## Minimum manifest

```json
{
  "schemaVersion": 1,
  "id": "your-app-id",
  "slug": "your-app-id",
  "name": "Your App",
  "description": "A short summary",
  "version": "1.0.0",
  "modelCategory": "none",
  "entry": "app/index.html"
}
```

## Valid model categories

- `none`
- `text`
- `multimodal`
- `code`

Use `none` by default.

## Recommended fields

- `category`
- `runtime`
- `tags`
- `features`
- `techStack`
- `usageSteps`
- `author`
- `links`
- `thumbnail`
- `icon`
- `screenshots`

## Packaging rules

- `entry` must stay under `app/`.
- Asset URLs inside the built app should be relative.
- Avoid absolute paths or host-specific base URLs.
- Keep the final zip at or under `25MB`.
- The same account can upload the same slug again to overwrite its own version.
- Different accounts cannot overwrite each other's slug.

## Upload endpoints

- Login: `POST /api/auth/login`
- Slug precheck: `GET /api/app-slug-check?slug=...`
- Import: `POST /api/import-app`
- Large-package upload token: `POST /api/upload-package-token`

Login uses `application/x-www-form-urlencoded`.

Import uses multipart form data with:

- `package`
- `modelCategory`

For large zip packages, the platform supports:

1. request a client upload token
2. upload the zip directly to Blob storage
3. finalize the import via `POST /api/import-app`
