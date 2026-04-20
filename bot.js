#!/usr/bin/env node
/**
 * Discord Bot Elemental - game-agnostic starter bot.
 *
 * CRITICAL RELEASE RULE:
 * - Always update CHANGELOG.md before every push to main.
 * - This bot reads the first version entry from CHANGELOG.md on startup.
 */

const fs = require('fs');
const path = require('path');
const express = require('express');
const { Client, GatewayIntentBits, Partials } = require('discord.js');
require('dotenv').config();

function parseChangelog() {
    try {
        const md = fs.readFileSync(path.join(__dirname, 'CHANGELOG.md'), 'utf8');
        const versionMatch = md.match(/^## \[(\d+\.\d+\.\d+)\]/m);
        return { version: versionMatch ? versionMatch[1] : '0.0.0' };
    } catch {
        return { version: '0.0.0' };
    }
}

const { version: BOT_VERSION } = parseChangelog();

const DATA_DIR = path.join(__dirname, 'data');
const KNOWLEDGE_PATH = path.join(DATA_DIR, 'knowledge.json');
const SUGGESTIONS_PATH = path.join(DATA_DIR, 'suggestions.json');
const ACTIVITY_PATH = path.join(DATA_DIR, 'activity.json');
const FEEDBACK_PATH = path.join(DATA_DIR, 'feedback.json');
const ACTIVITY_COOLDOWN_MS = 60_000;

const CONFIG = {
    // Keep top-level server branding flexible until finalized.
    gameProfile: {
        gameName: 'Legend of Elements',
        serverDisplayName: null, // e.g. "Tempest of Elements" (decide later)
        organizationType: 'clan', // game term uses clans, not guilds
    },
    roleNames: {
        base: 'Elemental Initiate',
        tier1: 'Tempest High Rank 3',
        tier2: 'Tempest High Rank 2',
        tier3: 'Tempest High Rank 1',
        tier4: 'Tempest Left Marshal',
    },
    clanRoleNames: {
        verified: 'XY Tempest Verified',
        officer: 'XY Tempest Officer',
        mainChat: 'tempest-clan-chat',
    },
    activityTiers: [
        { name: 'Tempest High Rank 3', threshold: 100 },
        { name: 'Tempest High Rank 2', threshold: 350 },
        { name: 'Tempest High Rank 1', threshold: 800 },
        { name: 'Tempest Left Marshal', threshold: 1500 },
    ],
    activityChannelIds: new Set([]), // Fill after channel creation
    activityChannelNames: new Set([
        'gameplay-general',
        'crafting-realm',
        'mount-realm',
        'trial-tower',
        'arena',
        'builds-and-refines',
        'spirits-and-relics',
        'codes-and-events',
        'help-and-questions',
    ]),
    channelBlueprint: {
        publicCategories: [
            {
                name: 'strategy',
                channels: [
                    'gameplay-general',
                    'crafting-realm',
                    'mount-realm',
                    'trial-tower',
                    'arena',
                    'builds-and-refines',
                    'spirits-and-relics',
                    'codes-and-events',
                    'help-and-questions',
                ],
            },
        ],
        privateClanCategory: {
            name: 'tempest-clan',
            channels: [
                'tempest-clan-chat',
                'clan-quests',
                'clan-events',
                'clan-vault',
                'treasure-trove',
                'clan-rank-promotion',
                'officer-planning',
            ],
        },
    },
    adminRoleNames: ['XY Tempest Officer', 'Admin', 'Moderator'],
};

function ensureFile(filePath, fallback) {
    if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2));
}

function loadJson(filePath, fallback) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
        return fallback;
    }
}

function saveJson(filePath, value) {
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function ensureDataFiles() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    ensureFile(KNOWLEDGE_PATH, { custom_facts: [] });
    ensureFile(SUGGESTIONS_PATH, []);
    ensureFile(ACTIVITY_PATH, {});
    ensureFile(FEEDBACK_PATH, []);
}

function isAdmin(member) {
    if (!member?.roles?.cache) return false;
    return member.roles.cache.some((r) => CONFIG.adminRoleNames.includes(r.name));
}

function awardActivityPoint(userId, username) {
    const map = loadJson(ACTIVITY_PATH, {});
    const now = Date.now();
    const entry = map[userId] || { points: 0, lastPointAt: 0, username };
    if (now - entry.lastPointAt < ACTIVITY_COOLDOWN_MS) return null;
    entry.points += 1;
    entry.lastPointAt = now;
    entry.username = username;
    map[userId] = entry;
    saveJson(ACTIVITY_PATH, map);
    return entry.points;
}

function isActivityChannel(channel) {
    if (!channel) return false;
    if (CONFIG.activityChannelIds.has(channel.id)) return true;
    return typeof channel.name === 'string' && CONFIG.activityChannelNames.has(channel.name);
}

function getActivityTier(points) {
    let current = { name: CONFIG.roleNames.base, threshold: 0 };
    for (const tier of CONFIG.activityTiers) {
        if (points >= tier.threshold) current = tier;
    }
    return current;
}

function getNextActivityTier(points) {
    return CONFIG.activityTiers.find((tier) => points < tier.threshold) || null;
}

function buildProgressBar(points) {
    const current = getActivityTier(points);
    const next = getNextActivityTier(points);
    if (!next) return '██████████ MAX';
    const start = current.threshold || 0;
    const span = Math.max(next.threshold - start, 1);
    const progress = Math.min(Math.max(points - start, 0), span);
    const filled = Math.floor((progress / span) * 10);
    return `${'█'.repeat(filled)}${'░'.repeat(10 - filled)}`;
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel],
});

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag} (v${BOT_VERSION})`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const isCommand = message.content.startsWith('!');

    if (message.guild && isActivityChannel(message.channel) && !isCommand) {
        awardActivityPoint(message.author.id, message.author.username);
    }

    if (!isCommand) return;
    const [rawCmd, ...rest] = message.content.slice(1).trim().split(' ');
    const cmd = (rawCmd || '').toLowerCase();
    const argText = rest.join(' ').trim();

    switch (cmd) {
        case 'ping':
            return message.reply(`Pong! v${BOT_VERSION}`);
        case 'help':
        case 'menu':
            return message.reply(
                [
                    '**Commands**',
                    '`!ping` - status',
                    '`!help` / `!menu` - command list',
                    '`!suggest <text>` - submit suggestion',
                    '`!addfact <text>` - add fact (admin)',
                    '`!rank` / `!level` - show your rank and progress',
                    '`!leaderboard` / `!lb` - top activity users',
                    '`!blueprint` - show planned channel blueprint',
                ].join('\n')
            );
        case 'suggest': {
            if (!argText) return message.reply('Usage: `!suggest <text>`');
            const list = loadJson(SUGGESTIONS_PATH, []);
            list.push({
                id: list.length + 1,
                text: argText,
                by: message.author.username,
                userId: message.author.id,
                at: new Date().toISOString(),
                status: 'pending',
            });
            saveJson(SUGGESTIONS_PATH, list);
            return message.reply('Suggestion received.');
        }
        case 'addfact': {
            if (!isAdmin(message.member)) return message.reply('Admin only command.');
            if (!argText) return message.reply('Usage: `!addfact <text>`');
            const knowledge = loadJson(KNOWLEDGE_PATH, { custom_facts: [] });
            if (!Array.isArray(knowledge.custom_facts)) knowledge.custom_facts = [];
            knowledge.custom_facts.push({
                text: argText,
                added_by: message.author.username,
                added_at: new Date().toISOString().split('T')[0],
            });
            saveJson(KNOWLEDGE_PATH, knowledge);
            return message.reply(`Fact added. Total custom facts: ${knowledge.custom_facts.length}`);
        }
        case 'rank':
        case 'level': {
            const map = loadJson(ACTIVITY_PATH, {});
            const entry = map[message.author.id] || { points: 0 };
            const points = entry.points || 0;
            const tier = getActivityTier(points);
            const next = getNextActivityTier(points);
            const bar = buildProgressBar(points);
            const nextLine = next
                ? `Next: **${next.name}** at **${next.threshold}** (${Math.max(next.threshold - points, 0)} to go)`
                : 'You are at the highest configured rank tier.';
            return message.reply(
                [
                    `**Rank:** ${tier.name}`,
                    `**Points:** ${points}`,
                    `**Progress:** ${bar}`,
                    nextLine,
                ].join('\n')
            );
        }
        case 'leaderboard':
        case 'lb': {
            const map = loadJson(ACTIVITY_PATH, {});
            const top = Object.values(map)
                .sort((a, b) => (b.points || 0) - (a.points || 0))
                .slice(0, 10);
            if (!top.length) return message.reply('No activity data yet.');
            const lines = top.map((u, i) => {
                const tier = getActivityTier(u.points || 0);
                return `${i + 1}. ${u.username} - ${u.points || 0} pts (${tier.name})`;
            });
            return message.reply(['**Activity Leaderboard**', ...lines].join('\n'));
        }
        case 'blueprint': {
            const publicList = CONFIG.channelBlueprint.publicCategories[0].channels.map((name) => `- #${name}`).join('\n');
            const clanList = CONFIG.channelBlueprint.privateClanCategory.channels.map((name) => `- #${name}`).join('\n');
            return message.reply(
                [
                    '**Server Blueprint (Template)**',
                    '',
                    '**Public Strategy Channels**',
                    publicList,
                    '',
                    '**Private Tempest Clan Channels**',
                    clanList,
                    '',
                    `Clan roles: **${CONFIG.clanRoleNames.verified}**, **${CONFIG.clanRoleNames.officer}**`,
                ].join('\n')
            );
        }
        default:
            return null;
    }
});

process.on('unhandledRejection', (e) => console.error('Unhandled rejection:', e));
process.on('uncaughtException', (e) => console.error('Uncaught exception:', e));

ensureDataFiles();

const app = express();
app.get('/health', (_req, res) => res.status(200).json({ ok: true, version: BOT_VERSION }));
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Health server listening on ${port}`));

if (!process.env.DISCORD_TOKEN) {
    console.error('Missing DISCORD_TOKEN. Bot login skipped.');
} else {
    client.login(process.env.DISCORD_TOKEN);
}
