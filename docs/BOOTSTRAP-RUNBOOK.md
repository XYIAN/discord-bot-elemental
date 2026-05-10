# Bootstrap Runbook

This is the authoritative sequence for taking this repo from scaffold to running bot.

## Stage 0: Prereqs

- Node.js 20+
- Discord app + bot created
- Bot token, client ID, guild ID available
- Repo cloned and dependencies installed

## Stage 1: Environment

1. Copy `.env.example` to `.env`.
2. Fill required values:
   - `DISCORD_TOKEN`
   - `CLIENT_ID`
   - `GUILD_ID`
   - `ADMIN_WEBHOOK` (recommended)
   - `GENERAL_CHAT_WEBHOOK` (optional)

## Stage 2: Dry-run bootstrap

Run:

```bash
npm run setup:dry-run
```

Confirm output looks correct for:
- roles
- categories/channels
- private permission patches
- welcome seeding targets

## Stage 3: Execute bootstrap

Run:

```bash
npm run setup:all
```

This creates roles/channels, applies private permissions, and seeds intro posts.

## Stage 4: Start and verify

Run:

```bash
npm start
```

Verify:
- bot logs in
- `!ping` responds
- `!help` responds
- `!rank` and `!leaderboard` respond
- `!blueprint` responds
- `/health` returns 200

## Stage 5: Deployment

- Create Railway project from repo
- Set environment variables
- Deploy
- Validate startup logs and healthcheck

## Stage 6: Handoff notes for future agents

Before ending any setup session:

1. Update `CHANGELOG.md`.
2. Document any naming/threshold/channel decisions in docs.
3. Leave explicit next steps in `docs/PROJECT-PLAN.md`.

## Stage 7: Pre-launch audit

Before declaring launch readiness:

```bash
npm run audit:ai
```

The script checks env, persona file, knowledge file, and the live Discord guild for the channels and roles the bot expects. Failures abort launch; warnings are advisory.

## Stage 8: Backups

See `docs/BACKUP-STRATEGY.md`. Default for v1.0.0:

```bash
npm run backup:data
```

## Stage 9: Incident response and rollback

When a deploy goes wrong:

1. Inspect Railway logs and the in-Discord `#debug-log` for the failing version's deploy banner.
2. Find the bad commit:

   ```bash
   git log --oneline -n 20
   ```

3. Revert it (preserves history):

   ```bash
   git revert <sha>
   git push origin main
   ```

   Railway will auto-rebuild and the bot will redeploy.
4. Confirm in `#changelog` that the previous good version is reposted (`postCurrentChangelog` runs on every boot).
5. If data was corrupted, restore from `data-backups/<timestamp>/` per `docs/BACKUP-STRATEGY.md` and redeploy again.
6. Post a brief incident note in `#debug-log` with: what broke, the reverted SHA, the restored backup (if any), and the fix plan.
