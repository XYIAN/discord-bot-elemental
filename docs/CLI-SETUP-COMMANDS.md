# CLI Setup Commands

## Install

```bash
cd /Users/kyle/code/discord-bot-elemental
npm install
```

## Configure env

```bash
cp .env.example .env
```

Fill `.env` values, then run:

## Validate config and runtime

```bash
node -c bot.js
node -e "JSON.parse(require('fs').readFileSync('data/knowledge.json','utf8')); console.log('knowledge ok')"
```

## Bootstrap preview (safe)

```bash
npm run setup:dry-run
```

## Bootstrap apply

```bash
npm run setup:roles
npm run setup:channels
npm run setup:permissions
npm run setup:welcome
```

or single-shot:

```bash
npm run setup:all
```

## Run bot locally

```bash
npm start
```

## Quick command checks (in Discord)

- `!ping`
- `!help`
- `!blueprint`
- `!rank`
- `!leaderboard`

## Git release flow

```bash
git add .
git commit -m "vX.Y.Z: summary"
git push
```

Always update `CHANGELOG.md` first.
