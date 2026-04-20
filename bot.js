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
    roleNames: {
        base: 'Member',
        tier1: 'Strategist',
        tier2: 'Veteran',
        tier3: 'Legend',
    },
    activityTiers: [
        { name: 'Strategist', threshold: 100 },
        { name: 'Veteran', threshold: 350 },
        { name: 'Legend', threshold: 1000 },
    ],
    activityChannelIds: new Set([]), // Fill after channel creation
    adminRoleNames: ['Admin', 'Moderator'],
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

    if (message.guild && CONFIG.activityChannelIds.has(message.channel.id) && !isCommand) {
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
                    '`!rank` - show your activity points',
                    '`!leaderboard` - top activity users',
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
            return message.reply(`You have **${entry.points}** activity points.`);
        }
        case 'leaderboard':
        case 'lb': {
            const map = loadJson(ACTIVITY_PATH, {});
            const top = Object.values(map)
                .sort((a, b) => (b.points || 0) - (a.points || 0))
                .slice(0, 10);
            if (!top.length) return message.reply('No activity data yet.');
            const lines = top.map((u, i) => `${i + 1}. ${u.username} - ${u.points} pts`);
            return message.reply(['**Activity Leaderboard**', ...lines].join('\n'));
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
