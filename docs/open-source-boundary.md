# Public repository boundary

This repository is a reproducible source snapshot, not a production data export.

## Included

- platform and API source code
- WeChat Mini Program source code
- creator skill source code
- example environment templates
- local and container runtime instructions
- curated examples with known redistribution rights

## Excluded

- runtime JSON records and hosted application files
- registered users, password hashes, sessions, emails, favorites, stars, and scores
- admin settings and rate-limit allowlists
- real OAuth, model, database, object-storage, or WeChat credentials
- generated packages and dependency directories
- applications whose authors have not explicitly granted redistribution rights

## Private source history

The public monorepo is produced as a clean snapshot. Historical private repositories remain separate because removed secrets can survive in Git history. Public releases should import reviewed current files rather than merge private histories without a dedicated history audit.
