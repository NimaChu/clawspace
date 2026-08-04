# Security policy

## Reporting a vulnerability

Please do not open a public issue for suspected vulnerabilities, exposed credentials, authentication bypasses, upload validation problems, or private user data.

Use GitHub's private vulnerability reporting feature for this repository. Include the affected component, reproduction steps, impact, and any suggested fix. Avoid accessing or retaining data that does not belong to you.

## Secrets and local data

CLAWSPACE supports local runtime storage. Treat the following as private and keep them outside Git:

- `.env` and `.env.*` files other than checked-in examples
- `runtime/` contents
- account exports and password hashes
- OAuth credentials and model API keys
- database URLs and object-storage tokens
- WeChat private project configuration

If a secret is committed, revoke or rotate it before removing it from Git history. Deleting the visible line alone is not sufficient.

## Self-hosting boundary

Before exposing a new instance to the Internet:

- set `ADMIN_EMAIL` before registration; the first registrant is not implicitly trusted
- use HTTPS so session and OAuth cookies are marked `Secure`
- configure `HOSTED_APPS_ORIGIN` as a separate origin routed to the same service
- do not let untrusted uploaded HTML/JavaScript share the account and administrator origin
- keep `runtime/`, uploaded packages, database dumps, and populated environment files outside source control

The local single-origin default is for trusted development only. A production reverse proxy should send the main hostname and the hosted-app hostname to the service; requests on the hosted-app hostname are restricted to `/hosted-apps/` assets.
Production HTML serving fails closed when `HOSTED_APPS_ORIGIN` is absent. `ALLOW_UNSAFE_SAME_ORIGIN_APPS=true` is only for trusted local demonstrations and must not be enabled on an Internet-facing instance.
