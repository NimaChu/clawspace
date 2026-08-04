# CLAWSPACE Scaling Roadmap

This note captures the current scalability judgment for CLAWSPACE and the recommended upgrade order as the platform grows.

## Current Architecture Snapshot

The platform currently runs on:

- Vercel for the web app and API routes
- PostgreSQL-backed runtime storage for `runtime/data/*`
- Vercel Blob or filesystem fallback for hosted apps and downloadable zips
- Static front-end app/game packages uploaded as zip files
- A shared platform LLM API for text, multimodal, and code apps

The most important current implementation detail is that app metadata is still treated like file content:

- app registry data is read from a JSON-style runtime file
- star data is also read from a JSON-style runtime file
- some list and ranking views still depend on full in-memory aggregation

That means the first real scaling bottleneck is not static asset delivery. It is metadata access patterns.

## What Breaks First

The likely bottlenecks, in order:

1. Metadata reads and writes
2. Shared model quota and AI traffic
3. Upload throughput and moderation/risk controls

Things that are less likely to fail first:

- static asset hosting for app files
- zip downloads
- basic Vercel page serving

The platform already avoids some important deployment limits:

- large uploads can use Blob client upload instead of only function body upload
- hosted apps and downloadable packages can live outside local disk
- auth/session/app data can already move through database-backed runtime storage

## Practical Capacity Estimate

These are judgment ranges, not hard limits:

### Stage A: Up to ~100 apps / ~100-300 DAU

This is within the comfort zone of the current architecture.

Recommended focus:

- improve creator onboarding
- keep the publish flow smooth
- add representative apps and templates
- maintain backups and basic abuse protection

### Stage B: ~100 to ~1,000 apps / ~300-1,000 DAU

This is where the current metadata model starts becoming the real risk.

The platform can still run, but app atlas pages, rankings, stars, and creator aggregation will become increasingly inefficient if they continue to read and rewrite large JSON-style runtime files.

Recommended focus:

- move app metadata to relational tables
- move star state to relational tables
- move creator aggregation to database queries

### Stage C: ~1,000 to ~10,000 apps / ~1,000-10,000 DAU

This is the discovery-and-search stage.

At this point the question is not “can users upload?” but “can users find the right apps quickly?”

Recommended focus:

- backend pagination for app lists
- cached rankings and tag aggregation
- search indexing
- cached creator pages
- precomputed featured/recommended lists

### Stage D: 10,000+ apps / larger public traffic

This is where CLAWSPACE should behave like a platform, not just a website.

Recommended focus:

- separate web layer
- separate app distribution layer
- separate model gateway layer
- dedicated quotas and analytics for AI traffic

## Recommended Upgrade Order

The best order is:

1. Replace JSON-style app metadata with database tables
2. Replace star storage with database tables
3. Add caching for home page, atlas, and creator views
4. Add search and tag aggregation infrastructure
5. Split upload/distribution/model concerns only when needed

This order gives the biggest gain for the least architectural churn.

## What Should Happen Next

When CLAWSPACE starts approaching the high end of Stage A or the beginning of Stage B, the next concrete architecture task should be:

- design real database tables for apps, versions, stars, creators, and audit logs

Suggested core tables:

- `apps`
- `app_versions`
- `app_stars`
- `creator_profiles`
- `audit_logs`
- `users`

## Short Conclusion

CLAWSPACE does not need a full platform rewrite yet.

It *does* need an eventual metadata-layer rewrite before scale reaches the multi-thousand-app range.

The near-term goal should be:

- keep growth moving
- improve creator experience
- delay heavy architectural work until the platform proves demand

The medium-term goal should be:

- move app and engagement metadata to real relational tables before discovery pages become too expensive
