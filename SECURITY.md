# Security policy

## Supported versions

Only the latest release on `main` receives security fixes.

## Reporting a vulnerability

Please **do not open a public issue**. Report privately through
[GitHub Security Advisories](https://github.com/Arphael/AtelieRoot/security/advisories/new).

Include the affected version, steps to reproduce and the impact. You should get a first answer
within 7 days. Once a fix is released, the advisory is published with credit unless you prefer
otherwise.

## Scope

Especially relevant: the local server (`server/atelieroot-server.js`) path checks, token, `Host`
validation and Content-Security-Policy; the desktop app backend (`src-tauri/`) path checks and
permissions; anything that lets a Markdown file run code or reach the network; anything that
deletes or overwrites files outside the rules in [docs/CONTRACT.md](docs/CONTRACT.md).
