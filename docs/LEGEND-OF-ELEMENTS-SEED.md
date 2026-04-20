# Legend of Elements Seed Notes

This is a starter context doc for initial taxonomy and naming. Verify against in-game data and community consensus before treating as canonical.

## Source snapshot used

- Public wiki root: <https://www.legendofelements.com/>
- Character example: Swordsman guide
- News example: Global launch notes
- In-game screenshots (2026-04-20) covering clan rank UI, clan hall, gameplay mode UI, and profile progression UI

## Initial category candidates for `knowledge.json`

- `classes`
- `elements`
- `spirits`
- `skills`
- `gear_refines`
- `mounts`
- `relics`
- `vessels`
- `events`
- `codes`
- `pvp`
- `pve`
- `custom_facts`

## Early terminology cues

- Classes mentioned: Swordsman, Sorcerer, Warrior
- Element examples: Wind, Thunder, Fire
- Companion system: Spirits (rarity-driven)
- Build stats frequently referenced: Speed, Skill DMG, Core Skill DMG, Crit Rate, Crit Damage

## Screenshot-derived confirmed labels

### Clan rank labels (visible in Rank panel)

- Chief Chancellor
- Left Chancellor
- Right Chancellor
- Chief Marshal
- Left Marshal
- Right Marshal
- High Rank 1
- High Rank 2
- High Rank 3

Related UI actions:
- Rank Privilege
- Rank Promotion

### Gameplay mode labels (visible in Gameplay panel)

- Realm Mode:
  - Crafting Realm
  - Mount Realm
- Trial Mode:
  - Trial Tower
  - Arena

### Clan hall labels (visible in Clan Hall panel)

- Clan Hall
- Clan Quests
- Clan Events
- Clan Vault
- Treasure Trove
- Clan List

## Current seeded state in repository

- `data/knowledge.json` now includes:
  - `game` profile for Legend of Elements
  - `classes`, `stats`, `gameplay_modes`, `clan_system`, `build_systems`
  - source references to wiki URLs and screenshot filenames

## Operational naming constraints

- Use **clan** wording in game-facing messages
- Keep main server/community name configurable until finalized
- Reserve **Tempest** branding for private clan section and clan-role names

## Next data-work step

Run a controlled fact-seed pass:

1. Define final top-level `knowledge.json` category map
2. Add 3-5 validated seed facts per category
3. Mark uncertain facts with source note for review
4. Enable suggestion moderation loop for community refinement
