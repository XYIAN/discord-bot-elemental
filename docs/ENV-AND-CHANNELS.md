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
| `ADMIN_WEBHOOK` | Admin/debug webhook |
| `GENERAL_CHAT_WEBHOOK` | General channel webhook (optional if using webhook flow) |

## Optional environment variables

| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY` | AI response engine |
| `OWNER_ID` | Owner-only commands |
| `PORT` | Health endpoint port (Railway sets this) |

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
| Clan verified role | `XY Tempest Verified` |
| Clan officer role | `XY Tempest Officer` |
| Admin role(s) | `...` |
