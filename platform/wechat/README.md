# CLAWSPACE WeChat

This directory contains the WeChat Mini Program discovery client for CLAWSPACE.

It provides native home, app atlas, search, creator, favorites, account, detail, sharing, and browser-handoff flows. The website remains the source of truth for apps, users, stars, scores, and creator data.

## Import locally

1. Open WeChat DevTools.
2. Import this directory as a Mini Program project.
3. Replace the public snapshot's `touristappid` with your own AppID locally.
4. Update `utils/config.js` to point at your HTTPS CLAWSPACE deployment.
5. Configure the deployment domain in the WeChat Mini Program console.

Keep `project.private.config.json` local; it is ignored by Git.

## Pages

```text
pages/
  home/
  atlas/
  app-detail/
  search/
  creators/
  creator-detail/
  me/
  runtime/
```

The `runtime` page performs a supported browser handoff where embedded external HTML is unavailable. It should not be treated as an independent database or a universal native renderer for uploaded web apps.

## Backend APIs

The client consumes public endpoints exposed by `../web/`, including app listings, search, creators, account data, favorites, and statistics. See [the platform integration plan](../web/docs/wechat-mini-program-shell-plan.md).
