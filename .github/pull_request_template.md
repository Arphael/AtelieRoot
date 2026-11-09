## What and why

## Checklist
- [ ] There is a test that fails without this change
- [ ] `npm test` and `npm run test:dist` pass
- [ ] `server/atelierroot-server.js` untouched, or the security impact is explained below
- [ ] No foreign content reaches the DOM unescaped
- [ ] Nothing really deletes files outside the trash rules
- [ ] No internet requests
- [ ] Docs updated (`docs/CONTRACT.md` for disk/backend behavior, `CHANGELOG.md`)
