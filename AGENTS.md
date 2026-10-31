<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

When asked to analyze this project from top to bottom, inspect the current files directly. Do not reuse old AI project context, handoffs, reviews, or recorded conclusions as a substitute for examining the current implementation. Create new project context only after the fresh analysis, and distinguish current findings from historical test evidence.


# Code rules

- ALWAYS edit existing code. NEVER create a new file or function if one
  already exists for that purpose. Search the codebase first.
- NEVER create files named new, old, v2, copy, backup, temp, or final.
  Change the original file in place (git keeps the history).
- When you replace code, DELETE the old code in the same change. No
  commented-out code, no leftover functions.
- Before adding any function, search for an existing one that does the
  same thing and reuse or extend it.
- Keep it simple: smallest change that works. No new abstractions, layers,
  or dependencies unless I ask.
- Do not add new npm packages without asking.
- At the end of every task, list: files changed, files created (and why),
  code deleted.