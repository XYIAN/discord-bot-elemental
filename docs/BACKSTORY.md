# Backstory and Operating Intent

## Why this project exists

This codebase is a focused community bot for **Legend of Elements**, built to replicate the successful operating model from a prior game server while avoiding game-specific carryover.

Core goals:

- Centralize trusted gameplay knowledge.
- Reward contribution through visible rank progression.
- Support public strategy collaboration and private clan operations.
- Keep setup repeatable so future agents/operators can continue without hidden tribal knowledge.

## Identity constraints

- Game: Legend of Elements
- Main community/server name: intentionally flexible (do not hardcode final branding)
- Private clan identity: Tempest
- Use **clan** terminology in user-facing copy (not guild)

## Product principles

1. **Operational clarity over magic**: prefer explicit scripts/runbooks to manual guesswork.
2. **Single source of truth**: keep bootstrap structures centralized in `config/bootstrap-config.json`.
3. **Terminal-first execution**: automate roles/channels/permissions/posting through scripts where possible.
4. **Safe release discipline**: changelog-first pushes and verifiable startup behavior.
5. **Future-agent continuity**: every key decision documented in-repo.

## Non-goals (for now)

- No premature modularization before core setup is stable.
- No speculative feature expansion beyond bootstrap and core command reliability.
- No hardcoding private tokens or environment secrets in committed files.

## Operational reality (post v1.0.0)

The bot now ships the full proven Discord-bot stack adapted for Tempest:

- **Onboarding (v0.5.0)**: `guildMemberAdd` auto-assigns the base role, posts a Tempest welcome embed in `#gameplay-general`, and DMs the new member. A reaction-role on the AI opt-in message grants `Elemental AI Enabled`. A clan recruit embed posts every other day to `#tempest-recruit` (or fallback).
- **Knowledge curation (v0.6.0)**: `!suggest`, `!opinion`, `!faq`, `!listfacts`, `!listopinions`, plus admin queue `!suggestions / !approve / !reject / !grant / !edit`. All schemas use stable IDs from `scripts/lib/data-store.js`. `seedDataFiles()` copies repo seeds to `DATA_VOLUME_PATH` on first boot only.
- **AI Q&A (v0.7.0)**: Tempest Commander persona answers in `#elemental-ai` only, grounded in `data/knowledge.json`. Vision answers gated to `XY Tempest Officer / Admin / Moderator`. Per-user text and vision cooldowns plus a daily token budget. Owner kill switch via `!ai on/off`. Thumbs-up/down feedback persists to `data/feedback.json`.
- **Game commands (v0.8.0)**: `!contributors`, `!post-clan-requirements`, `!reset` (manual fire of the 9 PM PT scheduler).
- **Forum tier roles (v0.9.0)**: Activity points auto-grant `Tempest Scribe` (50) → `Tempest Loremaster` (200) → `Tempest Archivist` (500). `!addfact` requires Loremaster+, `!removefact` requires Archivist; admins always bypass. Members can self-check via `!myperms`.
- **Launch readiness (v1.0.0)**: `npm run audit:ai` validates env, persona, knowledge, and the live guild. `npm run backup:data` snapshots `data/*.json` to `data-backups/<timestamp>/`. Backup paths and S3 alternative documented in `docs/BACKUP-STRATEGY.md`. Rollback via `git revert <sha> && git push` per `docs/BOOTSTRAP-RUNBOOK.md` Stage 9.
- **Optional ops (post v1.0.0 utility scripts)**: `scripts/sync-facts.js` deduplicates and renumbers `custom_facts`; `scripts/categorize-knowledge.js` infers and writes back per-fact `categories` for future channel routing.

## Future-agent ground rules

When picking up this repo:

1. Read `docs/PROJECT-PLAN.md` first to see which phase shipped which features.
2. New config goes in `config/bootstrap-config.json` under a named block — never scattered constants.
3. Channel and role lookups go through `findChannelByNames()` / `findRoleByName()`. Numeric IDs stay out of `bot.js`.
4. Update `CHANGELOG.md` (newest entry first, semver-ordered) before every push to `main`. The startup pipeline reads it and posts to `#changelog` + `#debug-log`.
5. Run `npm run audit:ai` before declaring a release. Resolve failures; warnings are advisory.
6. Never touch `discord-bot/` (the Archero 2 bot). This repo is `discord-bot-elemental` only.
7. Bot-direct posting only — webhooks are explicitly out of scope.
