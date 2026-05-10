# Project Plan

This repo is the baseline for launching a game-specific Discord bot for a new game/community while preserving proven operational patterns.

## Phase 1 - Foundation

- Baseline bot online with health endpoint and core commands
- Railway service connected
- Discord application + bot token configured
- Admin/debug/changelog channel wiring completed

## Phase 2 - Identity and community model (shipped in v0.5.0)

- Finalize game persona (tone, style, boundaries)
- Finalize clan naming (`Tempest`) and role hierarchy (`XY Tempest Verified`, `XY Tempest Officer`)
- Define channel taxonomy and permissions
- Publish welcome and rules content
- Auto-assign base role on join, welcome embed, DM pitch, reaction-role opt-in, every-other-day clan recruit

## Phase 3 - Knowledge system (shipped in v0.6.0)

- Define `knowledge.json` category map
- Seed starter facts (wiki + screenshot-confirmed labels)
- Enable suggestion workflow (`!suggest`, approvals, edit, grant)
- Enable admin fact management (`!addfact`, `!removefact`, `!faq`, `!listfacts`)
- Opinions store (`!opinion`, `!listopinions`, `!removeopinion`)
- Volume seeding when `DATA_VOLUME_PATH` is mounted

## Phase 4 - Gamification (shipped baseline; forum tiers in v0.9.0)

- Configure activity channels
- Configure tier thresholds and role names
- Validate `!rank` and `!leaderboard`
- Add anti-spam and cooldown controls
- Forum tier roles auto-granted (Tempest Scribe -> Loremaster -> Archivist) gating knowledge contribution

## Phase 5 - Hardening and operations

- Add richer debug instrumentation
- Add startup release-note posting to changelog channel
- Add backup strategy for data files
- Define incident and rollback runbook

## Phase 6 - AI Q&A (shipped in v0.7.0)

- Tempest Commander OpenAI Q&A in `#elemental-ai`
- Per-user memory + `!forget`
- Vision answers gated to trusted roles
- Cost guardrails (text + vision cooldowns, daily token budget)
- Owner kill switch `!ai on/off`, `!ai status`
- Thumbs feedback persisted to `data/feedback.json`
- Persona finalized in `docs/PERSONA.md`
