# Architecture

CLAWSPACE is split into four public surfaces with one canonical data owner.

```mermaid
flowchart LR
    A["Creator or agent"] --> B["clawapp-creator skill"]
    B --> C["CLAWSPACE package"]
    C --> D["Web platform"]
    D --> E["Filesystem runtime data"]
    D --> F["Hosted static apps"]
    D --> G["Public APIs"]
    G --> H["WeChat discovery client"]
```

## Web platform

`platform/web/` is the source of truth for users, creators, app metadata, uploads, stars, favorites, game scores, launch routes, downloads, and administrative actions.

The runtime storage layer supports local filesystem operation when `DATABASE_URL` is empty and `OBJECT_STORAGE_PROVIDER=filesystem`. Cloud database and object-storage adapters remain optional compatibility paths.

## WeChat client

`platform/wechat/` consumes public platform APIs. It does not own user or app records. Because individual-subject Mini Programs cannot depend on arbitrary external web content as a universal runtime, the client focuses on discovery, details, creators, favorites, sharing, and browser handoff.

## Creator skill

`skills/clawapp-creator/` guides compatible agents through creation, mobile-aware design, package validation, preview, account setup, and upload. Credentials are operator-local and are not part of the skill distribution.

## Example applications

`examples/` demonstrates the static package contract. Examples are not loaded into a deployment automatically; operators choose what to import.
