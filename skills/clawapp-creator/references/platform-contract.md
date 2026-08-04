# Nima Tech Space Platform Contract

## 0. Production site

- Public website: `https://www.nima-tech.space`
- API base URL: `https://www.nima-tech.space`

## 1. Supported app type

- Only static front-end apps and mini-games.
- The uploaded zip must be self-contained.
- Do not require a separate backend for the first version.

## 2. Required package structure

```text
manifest.json
README.md            # optional
assets/              # optional
app/                 # required
```

## 3. Minimum manifest

```json
{
  "schemaVersion": 1,
  "id": "your-app-id",
  "slug": "your-app-id",
  "name": "Your App",
  "description": "一句话描述",
  "version": "1.0.0",
  "modelCategory": "none",
  "entry": "app/index.html"
}
```

## 4. Valid model categories

- `none`
- `text`
- `multimodal`
- `code`

Use `none` by default.

## 5. Recommended fields

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

## 6. Packaging rules

- `entry` must stay under `app/`.
- Asset URLs inside the built app should be relative.
- Avoid absolute paths or host-specific base URLs.
- Keep the final zip at or under `25MB`.
- The same account can upload the same slug to overwrite its own old version.
- Different accounts cannot overwrite each other's slug. The platform will return a slug conflict.

## 7. Current upload endpoint

- Login: `POST /api/auth/login`
- Slug precheck: `GET /api/app-slug-check?slug=...`
- Import: `POST /api/import-app`
- Large-package client token: `POST /api/upload-package-token`

Login uses `application/x-www-form-urlencoded`.

Import uses multipart form data with:

- `package`
- `modelCategory`

For packages that are too large for direct server upload on Vercel, the site supports:

1. Requesting a client upload token from `POST /api/upload-package-token`
2. Uploading the zip directly to Vercel Blob
3. Finalizing the import by sending JSON to `POST /api/import-app`
