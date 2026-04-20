# Changelog

All notable changes to this project are documented here.

Versioning:
- Major = architecture resets/breaking
- Minor = new features/systems
- Patch = fixes/docs/content updates

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
