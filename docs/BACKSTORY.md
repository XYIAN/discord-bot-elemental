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
