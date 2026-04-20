# Environment and Channels

## Required environment variables

| Variable | Purpose |
|---|---|
| `DISCORD_TOKEN` | Bot token |
| `CLIENT_ID` | Discord application client ID |
| `GUILD_ID` | Discord server ID |
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
| Changelog | `#...` | `...` |
| Debug logs | `#...` | `...` |

## Role map template

| Purpose | Role name |
|---|---|
| Base member role | `...` |
| Tier 1 | `...` |
| Tier 2 | `...` |
| Tier 3 | `...` |
| Admin role(s) | `...` |
