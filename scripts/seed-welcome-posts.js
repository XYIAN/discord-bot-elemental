#!/usr/bin/env node
const path = require('path');
require('dotenv').config();
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local'), override: false });

const { getEnv, fetchGuildChannels, discordRequest } = require('./lib/discord-api');
const { loadBootstrapConfig } = require('./lib/bootstrap-config');

const isDryRun = process.argv.includes('--dry-run');

function channelMessageMap() {
    return {
        'gameplay-general': 'Welcome to gameplay-general. Share daily progression, route ideas, and practical strategy discussions.',
        'crafting-realm': 'Crafting Realm strategy channel: discuss Crafting Gem farming, efficiency routes, and gear crafting priorities.',
        'mount-realm': 'Mount Realm strategy channel: share Soulvine farming paths and mount upgrade sequencing.',
        'trial-tower': 'Trial Tower strategy channel: floor progression checkpoints, rank targets, and clear optimization.',
        arena: 'Arena strategy channel: PvP builds, class matchups, and rank-climb planning.',
        'builds-and-refines': 'Build and refine optimization: stat priorities, reroll decisions, and class-specific setups.',
        'spirits-and-relics': 'Spirits, relics, and vessel setup: synergy discussions and progression paths.',
        'codes-and-events': 'Active codes and event updates. Keep this channel focused on timely actionable info.',
        'help-and-questions': 'New here? Ask your questions and get setup help from the community.',
        'tempest-clan-chat': 'Private Tempest clan chat. Coordination and internal discussion only.',
        'clan-quests': 'Track and coordinate clan quest progress.',
        'clan-events': 'Plan clan event participation and assignments.',
        'clan-vault': 'Clan vault planning and allocation discussion.',
        'treasure-trove': 'Treasure Trove planning and reward routing.',
        'clan-rank-promotion': 'Clan rank progression and promotion criteria tracking.',
        'officer-planning': 'Officer-only planning and operations channel.',
    };
}

async function main() {
    const { token, guildId } = getEnv();
    const config = loadBootstrapConfig();
    const channels = await fetchGuildChannels(token, guildId);
    const messages = channelMessageMap();

    const targetNames = new Set([
        ...(config.channelBlueprint.publicCategories?.flatMap((c) => c.channels) || []),
        ...(config.channelBlueprint.privateClanCategory?.channels || []),
    ]);

    for (const channel of channels.filter((c) => c.type === 0 && targetNames.has(c.name))) {
        const content = messages[channel.name];
        if (!content) continue;
        if (isDryRun) {
            console.log(`+ dry-run seed welcome: #${channel.name}`);
            continue;
        }
        await discordRequest('POST', `/channels/${channel.id}/messages`, token, { content });
        console.log(`+ seeded welcome: #${channel.name}`);
    }
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
