# Architecture

## Runtime

- Node.js process running `bot.js`
- Discord Gateway client (`discord.js`)
- Embedded Express health endpoint (`/health`) for Railway checks

## Data model (file-based)

- `data/knowledge.json` - canonical game knowledge + custom facts
- `data/suggestions.json` - user-submitted pending/approved suggestions
- `data/activity.json` - user activity points + cooldown timestamps
- `data/feedback.json` - optional feedback trail for bot answers

## Command model

- Public utility commands (`!ping`, `!help`)
- Contribution commands (`!suggest`)
- Admin content commands (`!addfact`, `!removefact`)
- Gamification commands (`!rank`, `!leaderboard`)

## Configuration philosophy

- Game-specific names and IDs should live in explicit config blocks
- Avoid hardcoded channel IDs scattered throughout logic
- Keep all role/channel constants centralized
- Keep main server display naming configurable until finalized
- Use game-correct wording in user-facing copy (`clan` for Legend of Elements)

## Future modular split (optional)

When complexity grows, split into:

- `src/commands/`
- `src/services/knowledge/`
- `src/services/activity/`
- `src/services/discord/`
- `src/config/`
