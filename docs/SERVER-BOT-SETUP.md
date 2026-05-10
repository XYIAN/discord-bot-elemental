# Server and Bot Setup (CLI-First Workflow)

This runbook shows what can be done via terminal and what must be done in UI.

## 1) What must be done in Discord UI

Discord does not provide a full first-party CLI for application creation, so these are UI-required:

1. Create new Discord Application
2. Create Bot user under that application
3. Enable required bot intents:
   - Message Content Intent
   - Server Members Intent
4. Copy:
   - Bot token
   - Client/Application ID
5. Invite bot to server with Administrator (or equivalent scoped permissions)

## 2) What can be done via CLI/API

After token + guild ID exist, channels/roles can be created by script using Discord REST API.

Example workflow:

1. Fill `.env` with `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID`
2. Use node scripts (or one-off terminal scripts) to:
   - create roles (`XY Tempest Verified`, `XY Tempest Officer`)
   - create categories/channels from `docs/CHANNEL-BLUEPRINT.md`
   - apply permission overwrites for private clan channels

## 3) Railway setup (mostly UI, some CLI optional)

### UI path (recommended)

1. Create Railway project from GitHub repo
2. Set environment variables
3. Deploy
4. Check logs and `/health`

### CLI path (if Railway CLI installed)

```bash
railway login
railway link
railway variables set DISCORD_TOKEN=...
railway up
```

## 4) Minimum `.env` for first boot

```bash
DISCORD_TOKEN=...
CLIENT_ID=...
GUILD_ID=...
PORT=3000
```

Only these three are required for the current starter runtime:
- `DISCORD_TOKEN`
- `CLIENT_ID`
- `GUILD_ID`

Webhook and AI keys are optional unless those features are enabled.

## 5) Post-boot validation checklist

- `npm start` runs without syntax/runtime errors
- Bot appears online in Discord
- `!ping` responds
- `!help` responds
- `!rank` and `!leaderboard` respond
- `/health` returns `200`

## 6) Optional next automation pass

If you want full terminal-driven setup, add scripts:

- `scripts/create-roles.js`
- `scripts/create-channels.js`
- `scripts/seed-welcome-posts.js`

These can consume `docs/CHANNEL-BLUEPRINT.md` and `CONFIG` constants to avoid duplication.

## 7) Current executable setup scripts

This repo now includes:

- `scripts/create-roles.js`
- `scripts/create-channels.js`
- `scripts/apply-permissions.js`
- `scripts/seed-welcome-posts.js`

Run preview:

```bash
npm run setup:dry-run
```

Run apply:

```bash
npm run setup:all
```

## 8) Troubleshooting

### `Unknown Guild (10004)` from setup scripts

Cause:
- Bot token is valid but bot user is not added to the target server, or `GUILD_ID` is wrong.

Fix:
1. Confirm `GUILD_ID` is the server ID (Developer Mode → right-click server → Copy Server ID).
2. Re-run bot invite URL with scopes:
   - `bot`
   - `applications.commands`
3. Ensure the invited app is **Tempest Commander** (Application ID `1502933339642921000`).
4. Retry `npm run setup:dry-run`.
