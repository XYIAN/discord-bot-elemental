# Environment and Channels

Game-specific note:
- Target game uses **clan** terminology.
- Keep main server/community name configurable until finalized.
- Private clan section should be branded **Tempest**.

## Required environment variables

| Variable | Purpose |
|---|---|
| `DISCORD_TOKEN` | Bot token |
| `CLIENT_ID` | Discord application client ID |
| `GUILD_ID` | Discord server ID (Discord API naming; still used even when game calls it a clan) |

## Optional environment variables

| Variable | Purpose |
|---|---|
| `ADMIN_WEBHOOK` | Admin/debug webhook (only if webhook-based logging is enabled) |
| `GENERAL_CHAT_WEBHOOK` | General channel webhook (only if webhook posting is enabled) |
| `OPENAI_API_KEY` | AI response engine |
| `OWNER_ID` | Owner-only commands |
| `PORT` | Health endpoint port (Railway sets this) |
| `APP_NAME` | App metadata reference (non-secret) |
| `APP_DESCRIPTION` | App metadata reference (non-secret) |
| `APP_TAGS` | App metadata reference (non-secret) |
| `APP_ID` | App metadata reference (non-secret) |
| `APP_PUBLIC_KEY` | App metadata reference (non-secret) |

## App metadata (current)

| Field | Value |
|---|---|
| Name | `Tempest Commander` |
| Description | `A Legend of Elements community bot for Tempest: strategy help, clan coordination, knowledge tracking, rank progression, and gameplay guides for builds, spirits, relics, realms, arena, and events.` |
| Tags | `gaming`, `community`, `discord-bot`, `strategy`, `legendofelements` |
| Application ID | `1502933339642921000` |
| Public Key | `975e1a45bbbee7e4f202a798635aa84ca1ef5990c0a5f6fca0fb0dd99a0e4c5b` |

## Channel map template

Fill this out when building the new game community:

| Purpose | Channel name | Channel ID |
|---|---|---|
| Main Q&A | `#...` | `...` |
| General | `#...` | `...` |
| Strategy category | `#...` | `...` |
| Clan private category (Tempest) | `#...` | `...` |
| Tempest main chat | `#tempest-clan-chat` | `...` |
| Changelog | `#...` | `...` |
| Debug logs | `#...` | `...` |

## Role map template

| Purpose | Role name |
|---|---|
| Base member role | `...` |
| Tier 1 | `...` |
| Tier 2 | `...` |
| Tier 3 | `...` |
| Tier 4 | `...` |
| Clan verified role | `XY Tempest Verified` |
| Clan officer role | `XY Tempest Officer` |
| Admin role(s) | `...` |

## Starter activity ladder (clan-rank inspired)

| Threshold | Role |
|---|---|
| 0 | Elemental Initiate (base) |
| 100 | Tempest High Rank 3 |
| 350 | Tempest High Rank 2 |
| 800 | Tempest High Rank 1 |
| 1500 | Tempest Left Marshal |

## Blueprint references

- Channel taxonomy: `docs/CHANNEL-BLUEPRINT.md`
- End-to-end setup runbook: `docs/SERVER-BOT-SETUP.md`
