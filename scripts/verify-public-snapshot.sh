#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

if git ls-files | rg '(^|/)(\.env|\.env\.local|\.env\.container|accounts\.json|test-accounts\.json|project\.private\.config\.json)$' >/dev/null; then
  echo 'Private configuration or account data is tracked.' >&2
  exit 1
fi

if git ls-files | rg '(^platform/web/runtime/|(^|/)node_modules/)' >/dev/null; then
  echo 'Runtime data or dependencies are tracked.' >&2
  exit 1
fi

if git ls-files '*.zip' '*.tar.gz' | grep -q .; then
  echo 'Generated archive found in public snapshot.' >&2
  exit 1
fi

if rg -l --hidden --glob '!**/.git/**' \
  'vercel_blob_rw_[A-Za-z0-9_-]+|npg_[A-Za-z0-9_-]{12,}|sk-[A-Za-z0-9_-]{20,}' . >/dev/null; then
  echo 'Potential credential detected.' >&2
  exit 1
fi

while IFS= read -r -d '' json_file; do
  node -e 'JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"))' "$json_file"
done < <(find platform/wechat examples -type f -name '*.json' -print0)

node -e 'const c=require("./skills/clawapp-creator/upload-config.json"); if (c.email || c.password) process.exit(1)'
node -e 'const c=require("./platform/wechat/project.config.json"); if (c.appid !== "touristappid") process.exit(1)'

while IFS= read -r -d '' js_file; do
  node --check "$js_file" >/dev/null
done < <(find platform/wechat -type f -name '*.js' -print0)

python3 -m compileall -q skills/clawapp-creator/scripts

echo 'Public snapshot verification passed.'
