# Release Guide

Every push to `main` triggers deployment. Follow this process every time.

## Mandatory steps before push

1. Update `CHANGELOG.md` with a new entry.
2. Ensure newest version is the first `## [x.y.z]` entry.
3. Verify semver ordering (newest to oldest).
4. Verify bot syntax if code changed (`node -c bot.js`).

## Commit and push

```bash
git add .
git commit -m "vX.Y.Z: short summary"
git push
```

## Post-push verification

- Deploy succeeds in Railway
- Bot starts and connects
- Debug/deploy notification appears
- Changelog release notes post appears (or expected dedupe behavior)

## Never do this

- Do not push without changelog update
- Do not break changelog version order
- Do not commit `.env` or secrets
