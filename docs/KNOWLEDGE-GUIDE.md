# Knowledge Guide

## Goals

- Keep answers accurate and game-specific
- Track source of added facts
- Make updates easy for admins and contributors

## Base structure

`data/knowledge.json` should maintain stable top-level categories.

Example:

```json
{
  "game_modes": {},
  "characters": {},
  "gear": {},
  "economy": {},
  "custom_facts": []
}
```

## Contribution flow

1. User submits suggestion via `!suggest`
2. Admin reviews pending suggestions
3. Approved suggestion is written into structured knowledge or `custom_facts`
4. Contributor receives credit through moderation records

## Quality rules

- Prefer concise factual statements
- Avoid duplicates and near-duplicates
- Keep terminology consistent
- Use plain language for explainability
