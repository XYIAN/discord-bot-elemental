#!/usr/bin/env node
const path = require('path');
require('dotenv').config();
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local'), override: false });

const { getEnv, fetchGuildChannels, discordRequest } = require('./lib/discord-api');
const { loadBootstrapConfig } = require('./lib/bootstrap-config');

const isDryRun = process.argv.includes('--dry-run');

function buildChannelIndex(channels) {
    const map = new Map();
    for (const channel of channels) map.set(channel.name, channel.id);
    return map;
}

function channelLink(name, channelIds) {
    const id = channelIds.get(name);
    return id ? `<#${id}>` : `#${name}`;
}

function channelMessageMap(channelIds) {
    const links = {
        ai: channelLink('elemental-ai', channelIds),
        gameplay: channelLink('gameplay-general', channelIds),
        events: channelLink('codes-and-events', channelIds),
        help: channelLink('help-and-questions', channelIds),
        changelog: channelLink('changelog', channelIds),
        debug: channelLink('debug-log', channelIds),
        clanChat: channelLink('tempest-clan-chat', channelIds),
        clanQuests: channelLink('clan-quests', channelIds),
        clanEvents: channelLink('clan-events', channelIds),
    };

    return {
        'elemental-ai': {
            content: 'Tempest Commander online. Use this as your command + AI strategy hub.',
            embeds: [
                {
                    title: 'Elemental AI Command Hub',
                    description:
                        `Start in ${links.ai} for bot commands and quick guidance.\n\n` +
                        '**Core commands**\n' +
                        '• `!help` or `/help`\n' +
                        '• `!rank` or `/rank`\n' +
                        '• `!leaderboard` or `/leaderboard`\n' +
                        '• `!blueprint` or `/blueprint`\n\n' +
                        `Need setup support? Go to ${links.help}.`,
                    color: 3447003,
                    footer: { text: 'Tempest Commander • Legend of Elements' },
                },
            ],
        },
        'gameplay-general': {
            content: '⚡ Tempest Commander onboarding brief: read this message first.',
            embeds: [
                {
                    title: 'Start Here: Progress + Recruiting',
                    description:
                        `Use ${links.gameplay} for daily progress and practical strategy updates.\n\n` +
                        '**Recruiting note**\n' +
                        'Tempest is looking for active players who contribute daily and help the team stay competitive.\n' +
                        `If you want in, introduce yourself in ${links.help} and be ready for coordinated play.\n\n` +
                        '**Main lanes**\n' +
                        `• Strategy + Q&A: ${links.ai}\n` +
                        `• Event and code tracking: ${links.events}\n` +
                        `• Patch/update feed: ${links.changelog}`,
                    color: 5814783,
                    footer: { text: 'Tempest discipline wins seasons.' },
                },
            ],
        },
        'crafting-realm': 'Crafting Realm strategy channel: discuss Crafting Gem farming, efficiency routes, and gear crafting priorities.',
        'mount-realm': 'Mount Realm strategy channel: share Soulvine farming paths and mount upgrade sequencing.',
        'trial-tower': 'Trial Tower strategy channel: floor progression checkpoints, rank targets, and clear optimization.',
        arena: 'Arena strategy channel: PvP builds, class matchups, and rank-climb planning.',
        'builds-and-refines': 'Build and refine optimization: stat priorities, reroll decisions, and class-specific setups.',
        'spirits-and-relics': 'Spirits, relics, and vessel setup: synergy discussions and progression paths.',
        'codes-and-events': {
            content: 'Event operations + code tracking channel.',
            embeds: [
                {
                    title: 'Codes, Timers, and Reset Discipline',
                    description:
                        `Track active codes, rotating events, and deadline reminders here.\n\n` +
                        '**Daily reset standard**\n' +
                        '• Reset reminder posts at **9:00 PM Pacific**\n' +
                        '• Complete daily class\n' +
                        '• Register for clan raid\n\n' +
                        `For issues with reminders or bot behavior, report in ${links.debug}.`,
                    color: 15844367,
                },
            ],
        },
        'help-and-questions': {
            content: 'Welcome! Ask anything and the community will help.',
            embeds: [
                {
                    title: 'Tempest Onboarding',
                    description:
                        '**Post these to get fast help**\n' +
                        '• Your class + current build focus\n' +
                        '• Current wall/blocker (mode or stage)\n' +
                        '• Screenshot or short context\n\n' +
                        `Useful channels: ${links.ai}, ${links.gameplay}, ${links.events}`,
                    color: 1752220,
                },
            ],
        },
        changelog: `Release notes and update summaries are posted here. Watch ${links.changelog} for bot/game changes.`,
        'debug-log': `Operational debug stream for bot/runtime issues and noteworthy events. If commands fail, report details in ${links.debug}.`,
        'tempest-clan-chat': {
            content: 'Private Tempest clan operations.',
            embeds: [
                {
                    title: 'Clan Coordination Center',
                    description:
                        `Use ${links.clanChat} for active clan coordination.\n\n` +
                        '**Daily expectations**\n' +
                        '• Complete class objectives\n' +
                        '• Register for clan raid\n' +
                        '• Coordinate priorities in real time\n\n' +
                        `Related private channels: ${links.clanQuests} and ${links.clanEvents}.`,
                    color: 10181046,
                },
            ],
        },
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
    const channelIds = buildChannelIndex(channels);
    const messages = channelMessageMap(channelIds);

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
        const payload = typeof content === 'string' ? { content } : content;
        await discordRequest('POST', `/channels/${channel.id}/messages`, token, payload);
        console.log(`+ seeded welcome: #${channel.name}`);
    }
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
