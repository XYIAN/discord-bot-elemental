# Changelog

All notable changes to this project are documented here.

Versioning:

- Major = architecture resets/breaking
- Minor = new features/systems
- Patch = fixes/docs/content updates

## [0.3.5] - 2026-05-10

### Discord connection hardening

- Mirrored core runtime reliability behavior from the working bot by adding Discord login retry loop in `bot.js`.
- Changed startup behavior to fail loudly when `DISCORD_TOKEN` is missing instead of silently running disconnected.
- Expanded `/health` payload with Discord connection state so Railway "healthy but disconnected" cases are visible.

## [0.3.4] - 2026-05-10

### Themed welcome + recruiting onboarding messages

- Upgraded `scripts/seed-welcome-posts.js` to seed richer themed onboarding messages with embeds in key channels.
- Added dynamic channel-link insertion so welcome posts reference live channel IDs (e.g. AI hub, events, help, changelog, debug).
- Added recruitment-focused general intro copy aligned to Tempest clan positioning and daily accountability tone.

## [0.3.3] - 2026-05-10

### Daily reset reminder at 9 PM PT

- Added a themed in-process daily reset reminder scheduler for the Elemental bot at **9:00 PM Pacific**.
- Added channel fallback targeting (`#codes-and-events` -> `#gameplay-general` -> `#debug-log`) and reset message copy covering daily class completion and clan raid registration.
- Documented reminder behavior and config location in `docs/ENV-AND-CHANNELS.md`.

## [0.3.2] - 2026-05-10

### Slash command timeout fix

- Fixed slash command interaction handling so `/ping` and related commands no longer time out with "The application did not respond".
- Added defensive interaction error handling to return an explicit failure reply instead of silent timeouts.

## [0.3.1] - 2026-05-10

### Command reliability + ops channel parity

- Added Tempest Commander banner assets:
  - generated source banner
  - Discord-ready `680x240` bot banner crop
- Renamed AI channel/category naming from `arch-ai` to `elemental-ai` across config/docs/seeding to avoid cross-project naming bleed.
- Added guild slash commands (`/ping`, `/help`, `/blueprint`, `/rank`, `/leaderboard`) so core smoke-test commands work even when Message Content Intent is disabled for prefix commands.
- Refactored command execution into a shared handler used by both message commands and slash interactions.
- Added startup guidance log clarifying that `!` prefix commands require Message Content Intent in Discord Developer Portal.
- Expanded channel blueprint to include:
  - `elemental-ai` category with `#elemental-ai`
  - `ops` category with `#changelog` and `#debug-log`
- Updated welcome seeding messages for `#elemental-ai`, `#changelog`, and `#debug-log`.

## [0.3.0] - 2026-05-10

### Full bootstrap upgrade (repo + runbooks + automation scripts)

- Added centralized bootstrap configuration at `config/bootstrap-config.json`
- Added executable setup scripts:
  - `scripts/create-roles.js`
  - `scripts/create-channels.js`
  - `scripts/apply-permissions.js`
  - `scripts/seed-welcome-posts.js`
- Added shared script utilities:
  - `scripts/lib/discord-api.js`
  - `scripts/lib/bootstrap-config.js`
- Added npm setup commands:
  - `setup:roles`, `setup:channels`, `setup:permissions`, `setup:welcome`
  - `setup:dry-run`, `setup:all`
- Updated runtime config loading in `bot.js` to consume bootstrap config and `.env.local`
- Expanded operator docs and future-agent handoff docs:
  - `docs/BACKSTORY.md`
  - `docs/BOOTSTRAP-RUNBOOK.md`
  - `docs/CLI-SETUP-COMMANDS.md`
  - updates to `README.md`, `docs/ENV-AND-CHANNELS.md`, and `docs/SERVER-BOT-SETUP.md`
- Clarified required vs optional environment variables (only `DISCORD_TOKEN`, `CLIENT_ID`, and `GUILD_ID` are required for current starter runtime)
- Added troubleshooting guidance for `Unknown Guild (10004)` bootstrap failures

## [0.2.1] - 2026-05-10

### Assets

- Added generated Tempest / Legend of Elements Discord server icon at `assets/tempest-elements-discord-icon.png`
- Added square Discord-ready crops:
  - `assets/tempest-elements-discord-icon-square.png` (`1024x1024`)
  - `assets/tempest-elements-discord-icon-512.png` (`512x512`, preferred for Discord upload)

## [0.2.0] - 2026-04-20

### Phase 3: clan-rank ladder and server blueprint execution

- Upgraded activity tier ladder to clan-rank style:
  - Tempest High Rank 3 (100)
  - Tempest High Rank 2 (350)
  - Tempest High Rank 1 (800)
  - Tempest Left Marshal (1500)
- Added server/channel blueprint config blocks in `bot.js` for public strategy + private Tempest clan sections
- Added `activityChannelNames` fallback so XP can work before hardcoded channel IDs are assigned
- Improved `!rank`/`!level` output with:
  - current role tier
  - progress bar
  - next-tier threshold countdown
- Improved `!leaderboard` output to include each player's current tier label
- Added `!blueprint` command to print planned channel structure in-chat
- Added docs:
  - `docs/CHANNEL-BLUEPRINT.md`
  - `docs/SERVER-BOT-SETUP.md`
- Updated README and env/channel docs for Phase 3 conventions

## [0.1.1] - 2026-04-20

### Legend of Elements context + clan-first seed update

- Updated starter config toward Legend of Elements terminology (`clan` wording, flexible server display name)
- Added Tempest private-clan defaults (`XY Tempest Verified`, `XY Tempest Officer`, `tempest-clan-chat`)
- Expanded `data/knowledge.json` with initial structured seed:
  - classes, stats, gameplay modes, clan system, build systems, and source references
- Added screenshot-derived facts to seed data:
  - clan rank labels (Chief Chancellor/Marshal chain + High Rank tiers)
  - gameplay labels (Crafting Realm, Mount Realm, Trial Tower, Arena)
  - clan hall labels (Clan Quests, Clan Events, Clan Vault, Treasure Trove, Clan List)
- Expanded docs to reflect current state and next implementation path

## [0.1.0] - 2026-04-20

### Initial scaffold

- Created clean game-agnostic Discord bot starter repo
- Added `bot.js` with health endpoint, command skeleton, and activity points basics
- Added `data/` JSON stores (`knowledge`, `suggestions`, `activity`, `feedback`)
- Added docs runbooks for architecture, onboarding, release, and knowledge operations
- Configured Railway starter files and baseline Node project setup
