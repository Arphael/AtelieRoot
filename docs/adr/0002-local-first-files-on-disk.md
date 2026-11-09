# 2. Local-first: plain Markdown files, no cloud

- Status: accepted
- Date: 2026-11-06

## Context
The prototype synchronized documents to an online account. The product promise is "no cloud,
no accounts, no internet", and users want to keep using other tools on the same files.

## Decision
The source of truth is a folder of `.md` files on the user's disk. Metadata Markdown cannot hold
lives in `.atelierroot/state.json`. No sync service, no telemetry, no network requests from the app.
Conflicts with outside edits are resolved by keeping both versions, never by overwriting.

## Consequences
- Files work with any editor, git and sync tools the user already has.
- No cross-device sync built in; users can rely on their own sync tool.
- Every backend must implement the same safety rules ([CONTRACT.md](../CONTRACT.md)).
