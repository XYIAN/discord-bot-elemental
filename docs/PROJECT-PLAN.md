# Project Plan

This repo is the baseline for launching a game-specific Discord bot for a new game/community while preserving proven operational patterns.

## Phase 1 - Foundation

- Baseline bot online with health endpoint and core commands
- Railway service connected
- Discord application + bot token configured
- Admin/debug/changelog channel wiring completed

## Phase 2 - Identity and community model

- Finalize game persona (tone, style, boundaries)
- Finalize clan naming (`Tempest`) and role hierarchy (`XY Tempest Verified`, `XY Tempest Officer`)
- Define channel taxonomy and permissions
- Publish welcome and rules content

## Phase 3 - Knowledge system

- Define `knowledge.json` category map
- Seed starter facts (wiki + screenshot-confirmed labels)
- Enable suggestion workflow (`!suggest`, approvals)
- Enable admin fact management (`!addfact`, `!removefact`)

## Phase 4 - Gamification

- Configure activity channels
- Configure tier thresholds and role names
- Validate `!rank` and `!leaderboard`
- Add anti-spam and cooldown controls

## Phase 5 - Hardening and operations

- Add richer debug instrumentation
- Add startup release-note posting to changelog channel
- Add backup strategy for data files
- Define incident and rollback runbook
