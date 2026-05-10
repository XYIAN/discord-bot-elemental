# Discord Bot Elemental

Game-specific Discord bot template for building a branded knowledge + community assistant (persona, facts, role progression, strategy gamification) without carrying over old game content.

Current target game context:

- Game: **Legend of Elements**
- Main server name: **not finalized** (keep configurable)
- Private clan identity: **Tempest**
- Game terminology: use **clan** (not guild)

## Purpose

This repo is a clean foundation for a new game community bot using the proven architecture from the XYIAN bot:

- Single-process Discord bot + Express health endpoint
- Knowledge base file + suggestion workflow
- Role progression / activity XP system
- Changelog-driven release notes
- Railway deploy + debug visibility

All game/theme content should be configured for this new game only.

Clan-specific defaults currently staged in config:

- `XY Tempest Verified`
- `XY Tempest Officer`

## Quick Start

1. Install dependencies:

```bash
npm install
```

1. Copy `.env.example` to `.env` and set real values.

Minimum required runtime vars:

- `DISCORD_TOKEN`
- `CLIENT_ID`
- `GUILD_ID`

1. Run locally:

```bash
npm start
```

1. Deploy to Railway (after setting environment variables).

## Architecture

- Main bot: `bot.js`
- Data files: `data/`
- Documentation and runbooks: `docs/`
- Release history: `CHANGELOG.md`

## Core Commands

General:

- `!ping` / `/ping` - status
- `!help` / `!menu` / `/help` - full command list (grouped)
- `!rank` / `/rank` - your activity rank and progress
- `!leaderboard` / `/leaderboard` - top activity users
- `!blueprint` / `/blueprint` - planned channel + clan structure

Knowledge:

- `!suggest <text>` - submit a suggestion (anyone)
- `!opinion <text>` - record an opinion
- `!faq <topic>` - search the knowledge base
- `!listfacts [page]` / `!listopinions [page]` - paged lists
- `!addfact <text>` - gated by Tempest Loremaster + or admin
- `!removefact <id>` - gated by Tempest Archivist or admin

AI (only inside `#elemental-ai`):

- Just ask a question. Vision (image attachments) supported for trusted roles.
- `!ai status` / `!ai on` / `!ai off` (on/off owner only)
- `!forget` - clear your AI memory

Tempest game and admin:

- `!contributors` - aggregated knowledge contribution leaderboard
- `!myperms` - show your forum tier and capabilities
- `!recruit`, `!post-clan-requirements`, `!reset` - admin
- `!setupreaction` - post the AI opt-in reaction message (admin)
- `!post-changelog [x.y.z]`, `!debug-ping` - ops

## Blueprint Docs

- `docs/CHANNEL-BLUEPRINT.md` - public strategy and private Tempest clan channels
- `docs/SERVER-BOT-SETUP.md` - UI vs CLI setup workflow for Discord + Railway
- `docs/ENV-AND-CHANNELS.md` - env variables, role map, activity ladder, forum tier ladder
- `docs/BOOTSTRAP-RUNBOOK.md` - end-to-end implementation, audit, backup, rollback
- `docs/CLI-SETUP-COMMANDS.md` - copy/paste command cookbook
- `docs/BACKUP-STRATEGY.md` - data backup paths (manual / cron / S3)
- `docs/PERSONA.md` - Tempest Commander persona used by the AI
- `docs/BACKSTORY.md` - project intent and future-agent constraints

## Launch readiness

```bash
npm run audit:ai      # validate env, persona, knowledge, channels, roles
npm run backup:data   # snapshot data/*.json into data-backups/<timestamp>/
```

## Mandatory Release Rule

Always update `CHANGELOG.md` before every push to `main`.
The bot version and release notes are parsed from that file on startup.

See `docs/RELEASE-GUIDE.md` for non-negotiable release protocol.
