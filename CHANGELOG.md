# Changelog

All notable changes to this project are documented here.

Versioning:
- Major = architecture resets/breaking
- Minor = new features/systems
- Patch = fixes/docs/content updates

## [0.2.1] - 2026-05-10

### Assets

- Added generated Tempest / Legend of Elements Discord server icon at `assets/tempest-elements-discord-icon.png`

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
