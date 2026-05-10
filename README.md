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

## Core Commands (Template)

- `!ping` - bot status
- `!help` / `!menu` - command list
- `!suggest <text>` - queue a suggestion
- `!addfact <text>` - add knowledge fact (admin)
- `!rank` / `!level` - activity rank
- `!leaderboard` / `!lb` - top activity users
- `!blueprint` - show planned channel + clan structure

## Blueprint Docs

- `docs/CHANNEL-BLUEPRINT.md` - public strategy and private Tempest clan channels
- `docs/SERVER-BOT-SETUP.md` - UI vs CLI setup workflow for Discord + Railway
- `docs/ENV-AND-CHANNELS.md` - env variables, role map, and tier ladder
- `docs/BOOTSTRAP-RUNBOOK.md` - end-to-end implementation sequence
- `docs/CLI-SETUP-COMMANDS.md` - copy/paste command cookbook
- `docs/BACKSTORY.md` - project intent and future-agent constraints

## Mandatory Release Rule

Always update `CHANGELOG.md` before every push to `main`.
The bot version and release notes are parsed from that file on startup.

See `docs/RELEASE-GUIDE.md` for non-negotiable release protocol.
