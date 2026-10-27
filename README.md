# Nisaab360

Nisaab360 is my personal, proprietary school and learning-management platform, owned and maintained by [Hussnain Ahmad](https://github.com/MrHussnainAhmad).

Built with Next.js, React, TypeScript, PostgreSQL/Drizzle and Valkey, it supports multiple institutions with institution, staff, student, parent and platform portals, public institution websites and admissions.

This repository is not an open-source project and is not accepting public contributions. Access to the source code does not grant permission to copy, modify, redistribute, sell or deploy it. Any such use requires my explicit permission. All rights reserved for the original project code and assets; third-party dependencies and bundled fonts remain subject to their respective licenses.

The documentation below is for my own maintenance and for collaborators I authorize. Authorized collaborators and coding agents should read [AGENTS.md](AGENTS.md) before making changes.

Use [.env.example](.env.example) for configuration names and [deployment/README.md](deployment/README.md) for release instructions. `npm run verify:local` runs the maintained checks. `npm run build` creates a production build; `npm start` starts local dependencies, runs migrations and launches the application and email worker. Never copy private environment values or access tokens into documentation.

Operational references:

- [Payment gateway setup](docs/payment-gateway-setup.md)
- [Institution backups](docs/institution-backups.md)
- [Capacity operations](docs/operational-capacity.md)
- [Release and tenant-host setup](deployment/README.md)

Git excludes local seed/reset/repair tools, verifiers that use live service credentials, performance experiments, dated reports, captured diagnostics, credentials and generated artifacts. Build/runtime/release tools and maintained isolated checks are explicitly allowed in Git. Docker admits only six required build/runtime script inputs; tests and local/release/recovery tools stay outside production images. Local load tools under `k6/` and other excluded scripts remain usable in this workspace but are not included in a Git checkout.
