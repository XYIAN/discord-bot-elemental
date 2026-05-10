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
const { Client, GatewayIntentBits, Partials, REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();
require('dotenv').config({ path: path.join(__dirname, '.env.local'), override: false });

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

const CONFIG_PATH = path.join(__dirname, 'config', 'bootstrap-config.json');
const CONFIG = loadJson(CONFIG_PATH, {});
CONFIG.activityChannelIds = new Set(CONFIG.activityChannelIds || []);
CONFIG.activityChannelNames = new Set(CONFIG.activityChannelNames || []);
CONFIG.activityTiers = Array.isArray(CONFIG.activityTiers) ? CONFIG.activityTiers : [];
CONFIG.channelBlueprint = CONFIG.channelBlueprint || { publicCategories: [{ name: 'strategy', channels: [] }], privateClanCategory: { name: 'tempest-clan', channels: [] } };
CONFIG.clanRoleNames = CONFIG.clanRoleNames || { verified: 'XY Tempest Verified', officer: 'XY Tempest Officer', mainChat: 'tempest-clan-chat' };
CONFIG.adminRoleNames = Array.isArray(CONFIG.adminRoleNames) ? CONFIG.adminRoleNames : ['Admin'];
const APP_NAME = process.env.APP_NAME || CONFIG?.appMetadata?.name || 'Tempest Commander';
const APP_ID = process.env.APP_ID || CONFIG?.appMetadata?.applicationId || process.env.CLIENT_ID || null;

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

function buildSlashCommands() {
    return [
        new SlashCommandBuilder().setName('ping').setDescription('Check bot status and version'),
        new SlashCommandBuilder().setName('help').setDescription('Show command list'),
        new SlashCommandBuilder().setName('blueprint').setDescription('Show planned channel blueprint'),
        new SlashCommandBuilder().setName('rank').setDescription('Show your activity rank and progress'),
        new SlashCommandBuilder().setName('leaderboard').setDescription('Show activity leaderboard'),
    ].map((c) => c.toJSON());
}

async function registerGuildSlashCommands() {
    if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID || !process.env.GUILD_ID) {
        console.log('Skipping slash command registration: DISCORD_TOKEN/CLIENT_ID/GUILD_ID required.');
        return;
    }
    try {
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: buildSlashCommands() }
        );
        console.log('Registered guild slash commands: /ping /help /blueprint /rank /leaderboard');
    } catch (error) {
        console.error('Slash command registration failed:', error.message);
    }
}

async function executeCommand({ cmd, argText, member, userId, username, reply }) {
    switch (cmd) {
        case 'ping':
            return reply(`Pong! v${BOT_VERSION}`);
        case 'help':
        case 'menu':
            return reply(
                [
                    '**Commands**',
                    '`!ping` / `/ping` - status',
                    '`!help` / `!menu` / `/help` - command list',
                    '`!suggest <text>` - submit suggestion',
                    '`!addfact <text>` - add fact (admin)',
                    '`!rank` / `!level` / `/rank` - show your rank and progress',
                    '`!leaderboard` / `!lb` / `/leaderboard` - top activity users',
                    '`!blueprint` / `/blueprint` - show planned channel blueprint',
                ].join('\n')
            );
        case 'suggest': {
            if (!argText) return reply('Usage: `!suggest <text>`');
            const list = loadJson(SUGGESTIONS_PATH, []);
            list.push({
                id: list.length + 1,
                text: argText,
                by: username,
                userId,
                at: new Date().toISOString(),
                status: 'pending',
            });
            saveJson(SUGGESTIONS_PATH, list);
            return reply('Suggestion received.');
        }
        case 'addfact': {
            if (!isAdmin(member)) return reply('Admin only command.');
            if (!argText) return reply('Usage: `!addfact <text>`');
            const knowledge = loadJson(KNOWLEDGE_PATH, { custom_facts: [] });
            if (!Array.isArray(knowledge.custom_facts)) knowledge.custom_facts = [];
            knowledge.custom_facts.push({
                text: argText,
                added_by: username,
                added_at: new Date().toISOString().split('T')[0],
            });
            saveJson(KNOWLEDGE_PATH, knowledge);
            return reply(`Fact added. Total custom facts: ${knowledge.custom_facts.length}`);
        }
        case 'rank':
        case 'level': {
            const map = loadJson(ACTIVITY_PATH, {});
            const entry = map[userId] || { points: 0 };
            const points = entry.points || 0;
            const tier = getActivityTier(points);
            const next = getNextActivityTier(points);
            const bar = buildProgressBar(points);
            const nextLine = next
                ? `Next: **${next.name}** at **${next.threshold}** (${Math.max(next.threshold - points, 0)} to go)`
                : 'You are at the highest configured rank tier.';
            return reply(
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
            if (!top.length) return reply('No activity data yet.');
            const lines = top.map((u, i) => {
                const tier = getActivityTier(u.points || 0);
                return `${i + 1}. ${u.username} - ${u.points || 0} pts (${tier.name})`;
            });
            return reply(['**Activity Leaderboard**', ...lines].join('\n'));
        }
        case 'blueprint': {
            const publicList = (CONFIG.channelBlueprint.publicCategories || [])
                .map((cat) => [`**${cat.name}**`, ...(cat.channels || []).map((name) => `- #${name}`)].join('\n'))
                .join('\n\n');
            const clanList = CONFIG.channelBlueprint.privateClanCategory.channels.map((name) => `- #${name}`).join('\n');
            return reply(
                [
                    '**Server Blueprint (Template)**',
                    '',
                    publicList,
                    '',
                    `**${CONFIG.channelBlueprint.privateClanCategory.name}**`,
                    clanList,
                    '',
                    `Clan roles: **${CONFIG.clanRoleNames.verified}**, **${CONFIG.clanRoleNames.officer}**`,
                ].join('\n')
            );
        }
        default:
            return null;
    }
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
    console.log(`App: ${APP_NAME}${APP_ID ? ` [${APP_ID}]` : ''}`);
    if (!process.env.CLIENT_ID) console.log('Warning: CLIENT_ID is missing; invite/build scripts may fail.');
    if (!process.env.GUILD_ID) console.log('Warning: GUILD_ID is missing; setup scripts cannot target a server.');
    console.log('Note: Prefix commands (!ping, !help, etc.) require Message Content Intent enabled in Discord Developer Portal.');
    await registerGuildSlashCommands();
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

    return executeCommand({
        cmd,
        argText,
        member: message.member,
        userId: message.author.id,
        username: message.author.username,
        reply: (content) => message.reply(content),
    });
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    try {
        const cmd = interaction.commandName.toLowerCase();
        const optionText = interaction.options?.data?.find((o) => o.name === 'text')?.value;
        const argText = typeof optionText === 'string' ? optionText : '';
        const userId = interaction.user.id;
        const username = interaction.user.username;

        const reply = async (content) => {
            if (interaction.replied || interaction.deferred) {
                return interaction.followUp({ content });
            }
            return interaction.reply({ content });
        };

        await executeCommand({
            cmd,
            argText,
            member: interaction.member,
            userId,
            username,
            reply,
        });
    } catch (error) {
        console.error('Slash interaction failed:', error.message);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'Command failed. Check debug logs.' });
            return;
        }
        await interaction.reply({ content: 'Command failed. Check debug logs.', ephemeral: true });
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
