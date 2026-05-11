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
const { Client, GatewayIntentBits, Partials, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { nextId, SUGGESTION_STATUSES } = require('./scripts/lib/data-store');
require('dotenv').config();
require('dotenv').config({ path: path.join(__dirname, '.env.local'), override: false });

function parseChangelog() {
    try {
        const md = fs.readFileSync(path.join(__dirname, 'CHANGELOG.md'), 'utf8');
        const versionMatch = md.match(/^## \[(\d+\.\d+\.\d+)\]/m);
        const version = versionMatch ? versionMatch[1] : '0.0.0';

        const firstEntry = md.indexOf('## [');
        const secondEntry = md.indexOf('## [', firstEntry + 1);
        const section = secondEntry > -1 ? md.slice(firstEntry, secondEntry) : md.slice(firstEntry);
        const lines = section
            .split('\n')
            .filter((l) => /^- /.test(l.trim()))
            .map((l) => l.trim().replace(/^- /, ''));
        return { version, lines };
    } catch (error) {
        console.error('Could not parse CHANGELOG.md:', error.message);
        return { version: '0.0.0', lines: [] };
    }
}

function getChangelogLinesForVersion(targetVersion) {
    try {
        const md = fs.readFileSync(path.join(__dirname, 'CHANGELOG.md'), 'utf8');
        const startMarker = `## [${targetVersion}]`;
        const startIdx = md.indexOf(startMarker);
        if (startIdx === -1) return null;
        const afterStart = md.slice(startIdx);
        const nextEntry = afterStart.indexOf('\n## [');
        const section = nextEntry > -1 ? afterStart.slice(0, nextEntry) : afterStart;
        return section
            .split('\n')
            .filter((l) => /^- /.test(l.trim()))
            .map((l) => l.trim().replace(/^- /, ''));
    } catch {
        return null;
    }
}

function buildChangelogEmbeds(version, lines) {
    const HARD_LIMIT = 3900;
    const bullets = (lines || []).map((l) => `• ${l}`);
    const chunks = [];
    let current = '';
    for (const b of bullets) {
        if (current && current.length + b.length + 1 > HARD_LIMIT) {
            chunks.push(current);
            current = '';
        }
        const safeBullet = b.length > HARD_LIMIT ? b.slice(0, HARD_LIMIT - 3) + '...' : b;
        current += (current ? '\n' : '') + safeBullet;
    }
    if (current) chunks.push(current);
    if (chunks.length === 0) chunks.push('• (no entries)');

    return chunks.map((desc, idx) => {
        const e = new EmbedBuilder().setDescription(desc).setColor(0x5865f2);
        if (idx === 0) e.setTitle(`📦 ${APP_NAME} v${version}`);
        const isLast = idx === chunks.length - 1;
        const footer = chunks.length > 1
            ? `${APP_NAME} — Changelog (part ${idx + 1}/${chunks.length})`
            : `${APP_NAME} — Changelog`;
        e.setFooter({ text: footer });
        if (isLast) e.setTimestamp();
        return e;
    });
}

async function postChangelogToChannel(channel, version, lines) {
    const embeds = buildChangelogEmbeds(version, lines);
    const MAX_PER_MSG = 10;
    for (let i = 0; i < embeds.length; i += MAX_PER_MSG) {
        await channel.send({ embeds: embeds.slice(i, i + MAX_PER_MSG) });
    }
    return embeds.length;
}

const { version: BOT_VERSION, lines: BOT_CHANGELOG } = parseChangelog();

const REPO_DATA_DIR = path.join(__dirname, 'data');
const DATA_DIR = process.env.DATA_VOLUME_PATH || REPO_DATA_DIR;
const KNOWLEDGE_PATH = path.join(DATA_DIR, 'knowledge.json');
const SUGGESTIONS_PATH = path.join(DATA_DIR, 'suggestions.json');
const ACTIVITY_PATH = path.join(DATA_DIR, 'activity.json');
const FEEDBACK_PATH = path.join(DATA_DIR, 'feedback.json');
const OPINIONS_PATH = path.join(DATA_DIR, 'opinions.json');
const REACTION_ROLE_PATH = path.join(DATA_DIR, 'reaction-role.json');
const ACTIVITY_COOLDOWN_MS = 60_000;
const SUGGEST_COOLDOWN_MS = 60_000;
const SUGGEST_DAILY_MAX = 5;
const suggestCooldown = new Map();

const CONFIG_PATH = path.join(__dirname, 'config', 'bootstrap-config.json');
const CONFIG = loadJson(CONFIG_PATH, {});
CONFIG.activityChannelIds = new Set(CONFIG.activityChannelIds || []);
CONFIG.activityChannelNames = new Set(CONFIG.activityChannelNames || []);
CONFIG.activityTiers = Array.isArray(CONFIG.activityTiers) ? CONFIG.activityTiers : [];
CONFIG.channelBlueprint = CONFIG.channelBlueprint || { publicCategories: [{ name: 'strategy', channels: [] }], privateClanCategory: { name: 'tempest-clan', channels: [] } };
CONFIG.clanRoleNames = CONFIG.clanRoleNames || { verified: 'XY Tempest Verified', officer: 'XY Tempest Officer', mainChat: 'tempest-clan-chat' };
CONFIG.adminRoleNames = Array.isArray(CONFIG.adminRoleNames) ? CONFIG.adminRoleNames : ['Admin'];
CONFIG.dailyResetReminder = {
    enabled: CONFIG?.dailyResetReminder?.enabled !== false,
    timezone: CONFIG?.dailyResetReminder?.timezone || 'America/Los_Angeles',
    hour: Number.isInteger(CONFIG?.dailyResetReminder?.hour) ? CONFIG.dailyResetReminder.hour : 21,
    minute: Number.isInteger(CONFIG?.dailyResetReminder?.minute) ? CONFIG.dailyResetReminder.minute : 0,
    preferredChannelNames: Array.isArray(CONFIG?.dailyResetReminder?.preferredChannelNames) && CONFIG.dailyResetReminder.preferredChannelNames.length
        ? CONFIG.dailyResetReminder.preferredChannelNames
        : ['codes-and-events', 'gameplay-general', 'debug-log'],
};
CONFIG.opsChannels = {
    changelog: Array.isArray(CONFIG?.opsChannels?.changelog) && CONFIG.opsChannels.changelog.length
        ? CONFIG.opsChannels.changelog
        : ['changelog'],
    debug: Array.isArray(CONFIG?.opsChannels?.debug) && CONFIG.opsChannels.debug.length
        ? CONFIG.opsChannels.debug
        : ['debug-log'],
    changelogIds: Array.isArray(CONFIG?.opsChannels?.changelogIds)
        ? CONFIG.opsChannels.changelogIds
        : [],
    debugIds: Array.isArray(CONFIG?.opsChannels?.debugIds)
        ? CONFIG.opsChannels.debugIds
        : [],
};
CONFIG.welcomeChannelNames = Array.isArray(CONFIG?.welcomeChannelNames) && CONFIG.welcomeChannelNames.length
    ? CONFIG.welcomeChannelNames
    : ['gameplay-general', 'help-and-questions'];
CONFIG.reactionRole = {
    enabled: CONFIG?.reactionRole?.enabled !== false,
    emoji: CONFIG?.reactionRole?.emoji || '⚡',
    roleName: CONFIG?.reactionRole?.roleName || 'Elemental AI Enabled',
    channelNames: Array.isArray(CONFIG?.reactionRole?.channelNames) && CONFIG.reactionRole.channelNames.length
        ? CONFIG.reactionRole.channelNames
        : ['gameplay-general'],
    seedMessageIds: Array.isArray(CONFIG?.reactionRole?.seedMessageIds) ? CONFIG.reactionRole.seedMessageIds : [],
};
CONFIG.clanRecruit = {
    enabled: CONFIG?.clanRecruit?.enabled !== false,
    intervalDays: Number.isInteger(CONFIG?.clanRecruit?.intervalDays) && CONFIG.clanRecruit.intervalDays > 0
        ? CONFIG.clanRecruit.intervalDays
        : 2,
    preferredChannelNames: Array.isArray(CONFIG?.clanRecruit?.preferredChannelNames) && CONFIG.clanRecruit.preferredChannelNames.length
        ? CONFIG.clanRecruit.preferredChannelNames
        : ['tempest-recruit', 'gameplay-general'],
};
CONFIG.forumRoleTiers = Array.isArray(CONFIG?.forumRoleTiers) && CONFIG.forumRoleTiers.length
    ? CONFIG.forumRoleTiers
    : [
        { name: 'Tempest Scribe', threshold: 50, canSuggest: true, canAddOpinion: true, canAddFact: false, canRemoveFact: false, canListFacts: true },
        { name: 'Tempest Loremaster', threshold: 200, canSuggest: true, canAddOpinion: true, canAddFact: true, canRemoveFact: false, canListFacts: true },
        { name: 'Tempest Archivist', threshold: 500, canSuggest: true, canAddOpinion: true, canAddFact: true, canRemoveFact: true, canListFacts: true },
    ];
CONFIG.ai = {
    enabled: CONFIG?.ai?.enabled !== false,
    channelNames: Array.isArray(CONFIG?.ai?.channelNames) && CONFIG.ai.channelNames.length
        ? CONFIG.ai.channelNames
        : ['elemental-ai'],
    model: CONFIG?.ai?.model || 'gpt-4o-mini',
    visionModel: CONFIG?.ai?.visionModel || 'gpt-4o-mini',
    maxTokens: Number.isInteger(CONFIG?.ai?.maxTokens) && CONFIG.ai.maxTokens > 0 ? CONFIG.ai.maxTokens : 600,
    temperature: typeof CONFIG?.ai?.temperature === 'number' ? CONFIG.ai.temperature : 0.5,
    memoryTurns: Number.isInteger(CONFIG?.ai?.memoryTurns) && CONFIG.ai.memoryTurns > 0 ? CONFIG.ai.memoryTurns : 6,
    textCooldownMs: Number.isInteger(CONFIG?.ai?.textCooldownMs) ? CONFIG.ai.textCooldownMs : 15_000,
    visionCooldownMs: Number.isInteger(CONFIG?.ai?.visionCooldownMs) ? CONFIG.ai.visionCooldownMs : 60_000,
    dailyTokenBudget: Number.isInteger(CONFIG?.ai?.dailyTokenBudget) ? CONFIG.ai.dailyTokenBudget : 200_000,
    vision: {
        enabled: CONFIG?.ai?.vision?.enabled !== false,
        maxImages: Number.isInteger(CONFIG?.ai?.vision?.maxImages) ? CONFIG.ai.vision.maxImages : 2,
        detail: ['low', 'high', 'auto'].includes(CONFIG?.ai?.vision?.detail) ? CONFIG.ai.vision.detail : 'low',
        trustedRoleNames: Array.isArray(CONFIG?.ai?.vision?.trustedRoleNames) && CONFIG.ai.vision.trustedRoleNames.length
            ? CONFIG.ai.vision.trustedRoleNames
            : ['XY Tempest Officer', 'Admin', 'Moderator'],
    },
    feedback: {
        enabled: CONFIG?.ai?.feedback?.enabled !== false,
        thumbsUp: CONFIG?.ai?.feedback?.thumbsUp || '👍',
        thumbsDown: CONFIG?.ai?.feedback?.thumbsDown || '👎',
    },
    accessRoleNames: Array.isArray(CONFIG?.ai?.accessRoleNames) && CONFIG.ai.accessRoleNames.length
        ? CONFIG.ai.accessRoleNames
        : [],
    persona: typeof CONFIG?.ai?.persona === 'string'
        ? CONFIG.ai.persona
        : null,
};
if (!CONFIG.ai.accessRoleNames.length) {
    CONFIG.ai.accessRoleNames = Array.from(
        new Set([
            CONFIG.reactionRole.roleName,
            CONFIG.clanRoleNames.verified,
            CONFIG.clanRoleNames.officer,
            ...(CONFIG.adminRoleNames || []),
            'Server Booster',
        ].filter(Boolean))
    );
}
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

function seedDataFiles() {
    if (DATA_DIR === REPO_DATA_DIR) return;
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const seedFiles = ['knowledge.json', 'suggestions.json', 'activity.json', 'feedback.json', 'opinions.json', 'reaction-role.json'];
    for (const name of seedFiles) {
        const target = path.join(DATA_DIR, name);
        const source = path.join(REPO_DATA_DIR, name);
        if (!fs.existsSync(target) && fs.existsSync(source)) {
            try {
                fs.copyFileSync(source, target);
                console.log(`Seeded ${name} from repo to volume.`);
            } catch (error) {
                console.error(`Failed to seed ${name}: ${error.message}`);
            }
        }
    }
}

function ensureDataFiles() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    ensureFile(KNOWLEDGE_PATH, { custom_facts: [] });
    ensureFile(SUGGESTIONS_PATH, []);
    ensureFile(ACTIVITY_PATH, {});
    ensureFile(FEEDBACK_PATH, []);
    ensureFile(OPINIONS_PATH, []);
    ensureFile(REACTION_ROLE_PATH, { messageIds: CONFIG.reactionRole.seedMessageIds });
}

function getReactionRoleMessageIds() {
    const data = loadJson(REACTION_ROLE_PATH, { messageIds: [] });
    return Array.isArray(data.messageIds) ? data.messageIds : [];
}

function addReactionRoleMessageId(id) {
    const data = loadJson(REACTION_ROLE_PATH, { messageIds: [] });
    const list = Array.isArray(data.messageIds) ? data.messageIds : [];
    if (!list.includes(id)) list.push(id);
    saveJson(REACTION_ROLE_PATH, { messageIds: list });
    return list;
}

function isAdmin(member) {
    if (!member?.roles?.cache) return false;
    return member.roles.cache.some((r) => CONFIG.adminRoleNames.includes(r.name));
}

function isModerator(member) {
    if (!member?.roles?.cache) return false;
    return isAdmin(member) || member.roles.cache.some((r) => ['Moderator'].includes(r.name));
}

function hasVerifiedRole(member) {
    if (!member?.roles?.cache) return false;
    const allowed = [
        CONFIG.clanRoleNames.verified,
        CONFIG.clanRoleNames.officer,
        ...CONFIG.adminRoleNames,
        'Server Booster',
    ].filter(Boolean);
    return member.roles.cache.some((r) => allowed.includes(r.name));
}

function hasAIAccess(member) {
    if (!member?.roles?.cache) return false;
    if (hasVerifiedRole(member)) return true;
    return member.roles.cache.some((r) => CONFIG.ai.accessRoleNames.includes(r.name));
}

function canSuggest(userId) {
    const now = Date.now();
    const tracker = suggestCooldown.get(userId) || { count: 0, firstAt: now, lastAt: 0 };
    if (now - tracker.lastAt < SUGGEST_COOLDOWN_MS) return { ok: false, reason: 'Please wait a minute between suggestions.' };
    if (now - tracker.firstAt > 24 * 60 * 60 * 1000) {
        tracker.count = 0;
        tracker.firstAt = now;
    }
    if (tracker.count >= SUGGEST_DAILY_MAX) return { ok: false, reason: `You've hit the daily limit (${SUGGEST_DAILY_MAX} suggestions). Try again tomorrow!` };
    return { ok: true };
}

function recordSuggestion(userId) {
    const now = Date.now();
    const tracker = suggestCooldown.get(userId) || { count: 0, firstAt: now, lastAt: 0 };
    tracker.count += 1;
    tracker.lastAt = now;
    suggestCooldown.set(userId, tracker);
}

function parseApproveArgs(argText) {
    const text = String(argText || '');
    const sepIdx = text.indexOf('|');
    const left = (sepIdx === -1 ? text : text.slice(0, sepIdx)).trim();
    const overrideRaw = sepIdx === -1 ? '' : text.slice(sepIdx + 1).trim();
    const tokens = left.split(/\s+/).filter(Boolean);
    return {
        id: parseInt(tokens[0], 10),
        category: tokens[1] ? tokens[1].toLowerCase() : null,
        key: tokens[2] ? tokens[2].toLowerCase() : null,
        overrideText: overrideRaw.length > 0 ? overrideRaw : null,
    };
}

function autoKey(text, fallbackId) {
    const words = String(text || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 1 && !['the', 'and', 'for', 'with', 'this', 'that'].includes(w));
    const slug = words.slice(0, 3).join('_').slice(0, 30);
    return slug || `note_${fallbackId}`;
}

function applyApprovedToKnowledge({ category, key, text, by, suggestionId, source }) {
    const knowledge = loadJson(KNOWLEDGE_PATH, { custom_facts: [] });
    const today = new Date().toISOString().split('T')[0];
    const credit = `${by} (via suggestion)`;
    const entrySource = source || 'suggestion';

    if (!category || category === 'custom_facts') {
        if (!Array.isArray(knowledge.custom_facts)) knowledge.custom_facts = [];
        const id = nextId(knowledge.custom_facts);
        knowledge.custom_facts.push({
            id,
            text,
            added_by: credit,
            added_at: today,
            source: entrySource,
            suggestion_id: suggestionId,
        });
        saveJson(KNOWLEDGE_PATH, knowledge);
        return { ok: true, locator: 'custom_facts' };
    }

    if (category === 'opinions') {
        const opinions = loadJson(OPINIONS_PATH, []);
        opinions.push({
            id: nextId(opinions),
            text,
            by: credit,
            at: new Date().toISOString(),
            source: entrySource,
            suggestion_id: suggestionId,
        });
        saveJson(OPINIONS_PATH, opinions);
        return { ok: true, locator: 'opinions' };
    }

    if (!knowledge[category] || typeof knowledge[category] !== 'object' || Array.isArray(knowledge[category])) {
        knowledge[category] = {};
    }
    const finalKey = key || autoKey(text, suggestionId);
    knowledge[category][finalKey] = {
        text,
        added_by: credit,
        added_at: today,
        source: entrySource,
    };
    saveJson(KNOWLEDGE_PATH, knowledge);
    return { ok: true, locator: `${category}.${finalKey}` };
}

function countFacts() {
    const knowledge = loadJson(KNOWLEDGE_PATH, { custom_facts: [] });
    return Array.isArray(knowledge.custom_facts) ? knowledge.custom_facts.length : 0;
}

function getApprovedCountForUser(userId) {
    const suggestions = loadJson(SUGGESTIONS_PATH, []);
    return suggestions.filter((s) => (s.status === 'approved' || s.status === 'granted') && s.userId === userId).length;
}

function getContributorRoleTiers() {
    return [
        { name: CONFIG.reactionRole.roleName, threshold: 0, canSuggest: true, canAddFact: false, canAddOpinion: false, canRemoveFact: false, canListFacts: false },
        { name: 'Tempest Scribe', threshold: 5, canSuggest: true, canAddFact: true, canAddOpinion: true, canRemoveFact: false, canListFacts: true },
        { name: 'Tempest Loremaster', threshold: 15, canSuggest: true, canAddFact: true, canAddOpinion: true, canRemoveFact: true, canListFacts: true },
    ];
}

function getMemberTier(member) {
    if (!member?.roles?.cache) return null;
    const tiers = getContributorRoleTiers();
    for (let i = tiers.length - 1; i >= 0; i--) {
        if (member.roles.cache.some((r) => r.name === tiers[i].name)) return tiers[i];
    }
    return null;
}

function canMemberDo(member, permission) {
    if (isAdmin(member)) return true;
    if (hasVerifiedRole(member)) return true;
    const tier = getMemberTier(member);
    return tier ? tier[permission] === true : false;
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

function getForumTierForPoints(points) {
    let current = null;
    for (const tier of CONFIG.forumRoleTiers) {
        if (points >= tier.threshold) current = tier;
    }
    return current;
}

function memberForumPermissions(member, points) {
    const tier = getForumTierForPoints(points);
    return tier || { name: null, canSuggest: true, canAddOpinion: true, canAddFact: false, canRemoveFact: false, canListFacts: true };
}

function memberCanWithRoleOrAdmin(member, points, capability) {
    if (isAdmin(member)) return true;
    const perms = memberForumPermissions(member, points);
    return Boolean(perms[capability]);
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

function getTimePartsInZone(date, timeZone) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).formatToParts(date);
    const read = (type) => parts.find((p) => p.type === type)?.value || '00';
    return {
        year: Number(read('year')),
        month: Number(read('month')),
        day: Number(read('day')),
        hour: Number(read('hour')),
        minute: Number(read('minute')),
    };
}

function formatDateKey(parts) {
    return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function buildDailyResetMessage() {
    const localTime = `${String(CONFIG.dailyResetReminder.hour).padStart(2, '0')}:${String(CONFIG.dailyResetReminder.minute).padStart(2, '0')}`;
    return [
        `⚡ **Tempest Daily Reset Reminder (${localTime} PT)**`,
        '',
        'Daily reset is live. Stay on pace and lock in your progress:',
        '• Complete your **daily class**',
        '• **Register for clan raid** before the window closes',
        '• Clear key dailies and event tasks for steady growth',
        '',
        'Tempest discipline wins seasons.',
    ].join('\n');
}

function buildSlashCommands() {
    return [
        new SlashCommandBuilder().setName('ping').setDescription('Check bot status and version'),
        new SlashCommandBuilder().setName('help').setDescription('Show command list'),
        new SlashCommandBuilder().setName('blueprint').setDescription('Show planned channel blueprint'),
        new SlashCommandBuilder().setName('rank').setDescription('Show your activity rank and progress'),
        new SlashCommandBuilder().setName('leaderboard').setDescription('Show activity leaderboard'),
        new SlashCommandBuilder().setName('postwelcome').setDescription('Admin: post welcome embed in welcome channel'),
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
                    '**General**',
                    '`!ping` / `/ping` - status',
                    '`!help` / `!menu` / `/help` - command list',
                    '`!rank` / `!level` / `/rank` - show your rank and progress',
                    '`!leaderboard` / `!lb` / `/leaderboard` - top activity users',
                    '`!blueprint` / `/blueprint` - show planned channel blueprint',
                    '',
                    '**Knowledge**',
                    '`!suggest <text>` - submit suggestion',
                    '`!opinion <text>` - record an opinion',
                    '`!faq <topic>` - search knowledge base',
                    '`!listfacts [page]` - list custom facts',
                    '`!listopinions [page]` - list opinions',
                    '',
                    '**Admin (knowledge moderation)**',
                    '`!addfact <text>` - add fact',
                    '`!removefact <id>` - remove fact',
                    '`!removeopinion <id>` - remove opinion',
                    '`!suggestions [pending|approved|rejected|granted]` - list suggestion queue',
                    '`!edit <id> <text>` - edit suggestion text',
                    '`!approve <id> [category] [key] [| override]` / `!reject <id> [reason]` - decide a suggestion',
                    '`!grant @user` - manually grant AI access role',
                    '',
                    '**AI (in #elemental-ai)**',
                    'Requires **Elemental AI Enabled** or verified/admin roles.',
                    'Just ask a question - I will reply when AI is configured and your role has access.',
                    '`!ai status` - show AI runtime + budget',
                    '`!ai on` / `!ai off` - owner kill switch',
                    '`!forget` - clear your AI conversation memory',
                    '',
                    '**Tempest game**',
                    '`!contributors` / `!top` - top knowledge contributors',
                    '`!myperms` / `!perms` - show your forum tier and capabilities',
                    '',
                    '**Admin (ops)**',
                    '`!post-changelog [x.y.z]` - re-post changelog to #changelog',
                    '`!post-clan-requirements` - post Tempest clan requirements embed',
                    '`!recruit` - post Tempest clan recruit embed now',
                    '`!reset` - fire the daily reset reminder now',
                    '`!postwelcome` - post the full welcome embed in welcome channel',
                    '`!setupreaction` - post the AI opt-in reaction message',
                    '`!debug-ping` - smoke-test #debug-log post',
                ].join('\n')
            );
        case 'post-changelog':
        case 'postchangelog': {
            if (!isAdmin(member)) return reply('Admin only command.');
            const channel = await findChangelogChannel();
            if (!channel) return reply('No #changelog channel found.');
            const targetVersion = (argText || '').trim() || BOT_VERSION;
            if (!/^\d+\.\d+\.\d+$/.test(targetVersion)) {
                return reply('Usage: `!post-changelog [x.y.z]` - omit to post the current version.');
            }
            const lines = getChangelogLinesForVersion(targetVersion);
            if (!lines || lines.length === 0) {
                return reply(`No changelog entries found for v${targetVersion}.`);
            }
            try {
                const embedCount = await postChangelogToChannel(channel, targetVersion, lines);
                return reply(`Posted v${targetVersion} to #${channel.name} (${embedCount} embed${embedCount === 1 ? '' : 's'}).`);
            } catch (error) {
                return reply(`Changelog post failed: ${error.message}`);
            }
        }
        case 'debug-ping':
        case 'debugping': {
            if (!isAdmin(member)) return reply('Admin only command.');
            const ok = await sendDebug({ content: `🔧 Debug ping by ${username} - bot is connected and able to write to #debug-log.` });
            return reply(ok ? 'Sent debug ping.' : 'No #debug-log channel found.');
        }
        case 'recruit': {
            if (!isAdmin(member)) return reply('Admin only command.');
            const ok = await sendClanRecruit();
            return reply(ok ? 'Recruit embed sent.' : 'No recruit channel found.');
        }
        case 'setupreaction':
        case 'setup-reaction': {
            if (!isAdmin(member)) return reply('Admin only command.');
            const result = await sendReactionRoleOptInMessage();
            return reply(result.posted ? `Setup reaction message: ${result.status}` : `Setup reaction failed: ${result.status}`);
        }
        case 'postwelcome':
        case 'welcome': {
            if (!isAdmin(member)) return reply('Admin only command.');
            const channel = await findWelcomeChannel();
            if (!channel) return reply('No welcome channel found.');
            try {
                const embed = await buildWelcomeEmbed();
                await channel.send({ embeds: [embed] });
                return reply(`Posted welcome embed to #${channel.name}.`);
            } catch (error) {
                return reply(`Welcome post failed: ${error.message}`);
            }
        }
        case 'ai': {
            const sub = (argText || '').trim().toLowerCase();
            if (sub === 'status') {
                return reply(
                    [
                        `**AI status**`,
                        `runtime: ${aiRuntimeEnabled ? 'on' : 'off'}`,
                        `client: ${openai ? 'initialized' : 'not initialized (set OPENAI_API_KEY)'}`,
                        `model: ${CONFIG.ai.model}`,
                        `tokens spent today: ${aiTokenSpent} / ${CONFIG.ai.dailyTokenBudget}`,
                        `vision: ${CONFIG.ai.vision.enabled ? 'enabled' : 'disabled'} (trusted: ${CONFIG.ai.vision.trustedRoleNames.join(', ')})`,
                    ].join('\n')
                );
            }
            if (sub === 'on' || sub === 'off') {
                if (!isOwner(userId)) return reply('Owner only command.');
                aiRuntimeEnabled = sub === 'on';
                return reply(`AI runtime is now **${sub}**.`);
            }
            return reply('Usage: `!ai status` | `!ai on` | `!ai off` (on/off owner only)');
        }
        case 'forget': {
            clearUserMemory(userId);
            return reply('Cleared your AI conversation memory.');
        }
        case 'contributors':
        case 'top': {
            const facts = (loadJson(KNOWLEDGE_PATH, { custom_facts: [] }).custom_facts || []);
            const opinions = loadJson(OPINIONS_PATH, []);
            const suggestions = loadJson(SUGGESTIONS_PATH, []);
            const counts = new Map();
            const bump = (key, kind) => {
                if (!key) return;
                const e = counts.get(key) || { facts: 0, opinions: 0, suggestions: 0, total: 0 };
                e[kind] += 1;
                e.total += 1;
                counts.set(key, e);
            };
            for (const f of facts) bump(f.added_by || 'unknown', 'facts');
            for (const o of opinions) bump(o.by || 'unknown', 'opinions');
            for (const s of suggestions) bump(s.by || 'unknown', 'suggestions');
            const ranked = [...counts.entries()]
                .map(([name, c]) => ({ name, ...c }))
                .sort((a, b) => b.total - a.total)
                .slice(0, 10);
            if (!ranked.length) return reply('No contribution data yet.');
            const lines = ranked.map((r, i) => `${i + 1}. **${r.name}** - ${r.total} total (facts: ${r.facts}, opinions: ${r.opinions}, suggestions: ${r.suggestions})`);
            return reply(['**Top Contributors**', ...lines].join('\n'));
        }
        case 'post-clan-requirements':
        case 'postclanrequirements': {
            if (!isAdmin(member)) return reply('Admin only command.');
            const channel = await findChannelByNames(['tempest-clan-chat', ...CONFIG.welcomeChannelNames]);
            if (!channel) return reply('No clan-chat or welcome channel found to post to.');
            const embed = new EmbedBuilder()
                .setTitle('⚡ Tempest Clan Requirements')
                .setColor(0x5865f2)
                .setDescription(
                    [
                        'Tempest is a competitive Legend of Elements clan. To stay rostered:',
                        '',
                        '**Daily**',
                        '• Complete your daily class',
                        '• Register for clan raid before window closes',
                        '• Clear key dailies and event tasks',
                        '',
                        '**Weekly**',
                        '• Hit clan event participation thresholds',
                        '• Contribute to clan vault',
                        '',
                        '**Conduct**',
                        '• Respect officers and clanmates',
                        '• Report blockers in `#help-and-questions`',
                        '• Keep strategy talk in the right channel',
                        '',
                        'Officers will reach out about promotion paths once you are consistently active.',
                    ].join('\n')
                )
                .setFooter({ text: `${APP_NAME} - Tempest discipline wins seasons.` })
                .setTimestamp();
            try {
                await channel.send({ embeds: [embed] });
                return reply(`Posted clan requirements to #${channel.name}.`);
            } catch (error) {
                return reply(`Post failed: ${error.message}`);
            }
        }
        case 'reset': {
            if (!isAdmin(member)) return reply('Admin only command.');
            const sent = await sendDailyResetReminder();
            return reply(sent ? 'Daily reset reminder sent now.' : 'No target channel found.');
        }
        case 'myperms':
        case 'perms': {
            const userPoints = (loadJson(ACTIVITY_PATH, {})[userId]?.points) || 0;
            const approvedCount = getApprovedCountForUser(userId);
            const tier = getMemberTier(member);
            const isAdminFlag = isAdmin(member);
            const canSuggestFlag = hasAIAccess(member) || canMemberDo(member, 'canSuggest');
            const canAddOpinionFlag = canMemberDo(member, 'canAddOpinion');
            const canListFactsFlag = canMemberDo(member, 'canListFacts');
            const canAddFactFlag = canMemberDo(member, 'canAddFact');
            const canRemoveFactFlag = canMemberDo(member, 'canRemoveFact');
            return reply(
                [
                    `**Your forum status**`,
                    `Activity points: **${userPoints}**`,
                    `Approved suggestions: **${approvedCount}**`,
                    `Forum tier: **${tier?.name || 'none yet'}**`,
                    `Admin: **${isAdminFlag ? 'yes' : 'no'}**`,
                    '',
                    '**Capabilities**',
                    `- canSuggest: ${canSuggestFlag ? 'yes' : 'no'}`,
                    `- canAddOpinion: ${canAddOpinionFlag ? 'yes' : 'no'}`,
                    `- canListFacts: ${canListFactsFlag ? 'yes' : 'no'}`,
                    `- canAddFact: ${canAddFactFlag ? 'yes' : 'no'}`,
                    `- canRemoveFact: ${canRemoveFactFlag ? 'yes' : 'no'}`,
                ].join('\n')
            );
        }
        case 'suggest': {
            if (!hasAIAccess(member)) return reply('You need the **Elemental AI Enabled** or verified role to use this command.');
            if (!argText || argText.length < 10) return reply('Usage: `!suggest <your correction or suggestion>` (at least 10 characters)');
            const check = canSuggest(userId);
            if (!check.ok) return reply(`⏳ ${check.reason}`);
            const list = loadJson(SUGGESTIONS_PATH, []);
            const id = nextId(list);
            list.push({
                id,
                text: argText,
                by: username,
                userId,
                at: new Date().toISOString(),
                status: 'pending',
                decidedBy: null,
                decidedAt: null,
            });
            saveJson(SUGGESTIONS_PATH, list);
            recordSuggestion(userId);
            return reply(`Suggestion #${id} received. Admin will review.`);
        }
        case 'addfact': {
            if (!canMemberDo(member, 'canAddFact')) return reply('You need the **Tempest Scribe** role or higher to add facts.');
            if (!argText) return reply('Usage: `!addfact <text>`');
            const knowledge = loadJson(KNOWLEDGE_PATH, { custom_facts: [] });
            if (!Array.isArray(knowledge.custom_facts)) knowledge.custom_facts = [];
            const id = nextId(knowledge.custom_facts);
            knowledge.custom_facts.push({
                id,
                text: argText,
                added_by: username,
                added_at: new Date().toISOString().split('T')[0],
            });
            saveJson(KNOWLEDGE_PATH, knowledge);
            return reply(`Fact #${id} added. Total custom facts: ${knowledge.custom_facts.length}.`);
        }
        case 'listfacts':
        case 'lf': {
            const isDM = !member;
            if (!canMemberDo(member, 'canListFacts') && !isDM) return reply('You need the **Tempest Scribe** role or higher to use this command.');
            const knowledge = loadJson(KNOWLEDGE_PATH, { custom_facts: [] });
            const facts = Array.isArray(knowledge.custom_facts) ? knowledge.custom_facts : [];
            if (!facts.length) return reply('No custom facts yet. Use `!addfact <text>` (admin) to add.');
            const requested = parseInt((argText || '').trim(), 10);
            const page = Number.isInteger(requested) && requested > 0 ? requested : 1;
            const pageSize = 10;
            const totalPages = Math.max(1, Math.ceil(facts.length / pageSize));
            const safePage = Math.min(page, totalPages);
            const slice = facts.slice((safePage - 1) * pageSize, safePage * pageSize);
            const lines = slice.map((f) => `**#${f.id || '?'}** ${f.text} _(by ${f.added_by || 'unknown'})_`);
            return reply(['**Custom Facts**', ...lines, '', `Page ${safePage}/${totalPages} - use \`!listfacts <page>\` to navigate.`].join('\n'));
        }
        case 'removefact':
        case 'rf': {
            if (!canMemberDo(member, 'canRemoveFact')) return reply('You need the **Tempest Loremaster** role or admin to remove facts.');
            const id = parseInt((argText || '').trim(), 10);
            if (!Number.isInteger(id)) return reply('Usage: `!removefact <id>`');
            const knowledge = loadJson(KNOWLEDGE_PATH, { custom_facts: [] });
            if (!Array.isArray(knowledge.custom_facts)) knowledge.custom_facts = [];
            const before = knowledge.custom_facts.length;
            knowledge.custom_facts = knowledge.custom_facts.filter((f) => Number(f.id) !== id);
            if (knowledge.custom_facts.length === before) return reply(`No fact found with id ${id}.`);
            saveJson(KNOWLEDGE_PATH, knowledge);
            return reply(`Fact #${id} removed. Remaining: ${knowledge.custom_facts.length}.`);
        }
        case 'faq': {
            const isDM = !member;
            if (!canMemberDo(member, 'canListFacts') && !isDM) return reply('You need the **Tempest Scribe** role or higher to use this command.');
            const topic = (argText || '').trim().toLowerCase();
            if (!topic) return reply('Usage: `!faq <topic>` - searches knowledge for matching keywords.');
            const knowledge = loadJson(KNOWLEDGE_PATH, {});
            const hits = [];
            const facts = Array.isArray(knowledge.custom_facts) ? knowledge.custom_facts : [];
            for (const f of facts) {
                if (typeof f.text === 'string' && f.text.toLowerCase().includes(topic)) {
                    hits.push(`**Fact #${f.id || '?'}**: ${f.text}`);
                }
            }
            const walk = (obj, trail) => {
                if (typeof obj === 'string') {
                    if (obj.toLowerCase().includes(topic)) hits.push(`**${trail.join(' / ')}**: ${obj}`);
                    return;
                }
                if (Array.isArray(obj)) {
                    obj.forEach((v, i) => walk(v, [...trail, String(i)]));
                    return;
                }
                if (obj && typeof obj === 'object') {
                    for (const [k, v] of Object.entries(obj)) walk(v, [...trail, k]);
                }
            };
            for (const [k, v] of Object.entries(knowledge)) {
                if (k === 'custom_facts') continue;
                walk(v, [k]);
            }
            if (!hits.length) return reply(`No knowledge entries matched "${topic}".`);
            const limited = hits.slice(0, 10);
            const truncated = hits.length > limited.length ? `\n\n_Showing first ${limited.length} of ${hits.length} matches._` : '';
            return reply([`**FAQ matches for "${topic}"**`, ...limited].join('\n') + truncated);
        }
        case 'opinion': {
            if (!canMemberDo(member, 'canAddOpinion')) return reply('You need the **Tempest Scribe** role or higher to share opinions.');
            if (!argText) return reply('Usage: `!opinion <text>`');
            const list = loadJson(OPINIONS_PATH, []);
            const id = nextId(list);
            list.push({
                id,
                text: argText,
                by: username,
                userId,
                at: new Date().toISOString(),
            });
            saveJson(OPINIONS_PATH, list);
            return reply(`Opinion #${id} recorded.`);
        }
        case 'listopinions':
        case 'lo': {
            const isDM = !member;
            if (!canMemberDo(member, 'canListFacts') && !isDM) return reply('You need the **Tempest Scribe** role or higher to use this command.');
            const list = loadJson(OPINIONS_PATH, []);
            if (!list.length) return reply('No opinions yet. Use `!opinion <text>` to add one.');
            const requested = parseInt((argText || '').trim(), 10);
            const page = Number.isInteger(requested) && requested > 0 ? requested : 1;
            const pageSize = 10;
            const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
            const safePage = Math.min(page, totalPages);
            const slice = list.slice((safePage - 1) * pageSize, safePage * pageSize);
            const lines = slice.map((o) => `**#${o.id}** ${o.text} _(by ${o.by})_`);
            return reply(['**Opinions**', ...lines, '', `Page ${safePage}/${totalPages}`].join('\n'));
        }
        case 'removeopinion':
        case 'ro': {
            if (!canMemberDo(member, 'canRemoveFact')) return reply('You need the **Tempest Loremaster** role or admin to remove opinions.');
            const id = parseInt((argText || '').trim(), 10);
            if (!Number.isInteger(id)) return reply('Usage: `!removeopinion <id>`');
            const list = loadJson(OPINIONS_PATH, []);
            const before = list.length;
            const next = list.filter((o) => Number(o.id) !== id);
            if (next.length === before) return reply(`No opinion found with id ${id}.`);
            saveJson(OPINIONS_PATH, next);
            return reply(`Opinion #${id} removed.`);
        }
        case 'suggestions':
        case 'queue': {
            if (!isModerator(member)) return reply('This command requires the **Moderator**, **Officer**, or **Admin** role.');
            const filterArg = (argText || 'pending').trim().toLowerCase();
            const status = SUGGESTION_STATUSES.includes(filterArg) ? filterArg : 'pending';
            const list = loadJson(SUGGESTIONS_PATH, []);
            const filtered = list.filter((s) => (s.status || 'pending') === status);
            if (!filtered.length) return reply(`No suggestions with status "${status}".`);
            const lines = filtered.slice(0, 15).map((s) => `**#${s.id}** ${s.text} _(by ${s.by}, status: ${s.status})_`);
            return reply([`**Suggestions [${status}]**`, ...lines].join('\n'));
        }
        case 'edit': {
            if (!isModerator(member)) return reply('This command requires the **Moderator**, **Officer**, or **Admin** role.');
            const m = (argText || '').match(/^(\d+)\s+(.+)$/s);
            if (!m) return reply('Usage: `!edit <id> <new text>`');
            const id = parseInt(m[1], 10);
            const newText = m[2].trim();
            if (newText.length < 10) return reply('Usage: `!edit <id> <new text>` (minimum 10 characters).');
            const list = loadJson(SUGGESTIONS_PATH, []);
            const target = list.find((s) => Number(s.id) === id && (s.status || 'pending') === 'pending');
            if (!target) return reply(`No pending suggestion found with id ${id}.`);
            if (!target.original_text) target.original_text = target.text;
            target.text = newText;
            target.edited_by = username;
            target.edited_at = new Date().toISOString();
            saveJson(SUGGESTIONS_PATH, list);
            return reply(`Suggestion #${id} updated.`);
        }
        case 'approve': {
            if (!isModerator(member)) return reply('This command requires the **Moderator**, **Officer**, or **Admin** role.');
            const args = parseApproveArgs(argText);
            if (!args.id || Number.isNaN(args.id)) {
                return reply('Usage: `!approve <id> [category] [key] [| override text]`');
            }
            const list = loadJson(SUGGESTIONS_PATH, []);
            const target = list.find((s) => Number(s.id) === args.id && (s.status || 'pending') === 'pending');
            if (!target) return reply(`No pending suggestion found with id ${args.id}.`);
            const finalText = args.overrideText || target.text;
            const finalCategory = args.category || target.proposed_category || 'custom_facts';
            const finalKey = args.key || target.proposed_key || null;
            const result = applyApprovedToKnowledge({
                category: finalCategory,
                key: finalKey,
                text: finalText,
                by: target.by || username,
                suggestionId: target.id,
                source: target.source || 'suggestion',
            });
            if (!result.ok) return reply(`Approve failed: ${result.error || 'unknown error'}`);
            target.status = 'approved';
            target.decidedBy = username;
            target.decidedAt = new Date().toISOString();
            target.approved_category = finalCategory;
            target.approved_locator = result.locator;
            if (args.overrideText) {
                if (!target.original_text) target.original_text = target.text;
                target.text = finalText;
                target.edited_by = `${username} (at approval)`;
                target.edited_at = target.decidedAt;
            }
            saveJson(SUGGESTIONS_PATH, list);
            if (target.userId && member?.guild) {
                await checkContributorTierUpgrade(member.guild, target.userId, target.by || username);
            }
            const approvedCount = target.userId ? getApprovedCountForUser(target.userId) : 0;
            return reply(
                `Suggestion #${args.id} approved and filed under \`${result.locator}\`.\n` +
                `> ${finalText.slice(0, 200)}\n` +
                `${countFacts()} custom facts total. ${target.by || 'user'} now has ${approvedCount} approved.`
            );
        }
        case 'reject': {
            if (!isModerator(member)) return reply('This command requires the **Moderator**, **Officer**, or **Admin** role.');
            const parts = String(argText || '').split(/\s+/);
            const id = parseInt(parts[0], 10);
            if (!Number.isInteger(id)) return reply('Usage: `!reject <id>`');
            const reason = parts.slice(1).join(' ') || 'No reason given';
            const list = loadJson(SUGGESTIONS_PATH, []);
            const target = list.find((s) => Number(s.id) === id && (s.status || 'pending') === 'pending');
            if (!target) return reply(`No pending suggestion found with id ${id}.`);
            target.status = 'rejected';
            target.decidedBy = username;
            target.decidedAt = new Date().toISOString();
            target.reason = reason;
            saveJson(SUGGESTIONS_PATH, list);
            return reply(`Suggestion #${id} rejected. Reason: ${reason}`);
        }
        case 'grant': {
            if (!isModerator(member)) return reply('This command requires the **Moderator**, **Officer**, or **Admin** role.');
            const m = (argText || '').match(/<@!?(\d+)>|(\d+)/);
            const targetUserId = m ? (m[1] || m[2]) : null;
            if (!targetUserId) return reply('Usage: `!grant @user` — assigns the AI access role.');
            const guild = member?.guild;
            if (!guild) return reply('This command must be run in server channels.');
            const targetMember = await guild.members.fetch(targetUserId).catch(() => null);
            if (!targetMember) return reply('Could not find that member in this server.');
            const roleName = CONFIG.reactionRole.roleName;
            const role = guild.roles.cache.find((r) => r.name === roleName);
            if (!role) return reply(`Role "${roleName}" not found in this server.`);
            if (targetMember.roles.cache.has(role.id)) return reply(`${targetMember.user.username} already has **${roleName}**.`);
            try {
                await targetMember.roles.add(role);
            } catch (e) {
                return reply(`Grant failed: ${e.message}`);
            }
            try {
                await targetMember.send(
                    `🤖 You've been granted **${roleName}**.\n\n` +
                    `You can now ask questions in #elemental-ai and use \`!suggest\`.`
                );
            } catch {
                // best effort
            }
            await sendDebug({
                content: `🤖 Role manually granted\nUser: **${targetMember.user.username}** (${targetMember.id})\nRole: **${roleName}**\nGranted by: ${username}`,
            });
            return reply(`Assigned **${roleName}** to ${targetMember.user.username}.`);
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

const MESSAGE_CONTENT_INTENT_ENABLED = process.env.ENABLE_MESSAGE_CONTENT_INTENT
    ? String(process.env.ENABLE_MESSAGE_CONTENT_INTENT).toLowerCase() === 'true'
    : true;
const GUILD_MEMBERS_INTENT_ENABLED = process.env.ENABLE_GUILD_MEMBERS_INTENT
    ? String(process.env.ENABLE_GUILD_MEMBERS_INTENT).toLowerCase() === 'true'
    : true;

const clientIntents = [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages,
];
if (GUILD_MEMBERS_INTENT_ENABLED) {
    clientIntents.push(GatewayIntentBits.GuildMembers);
}
if (MESSAGE_CONTENT_INTENT_ENABLED) {
    clientIntents.push(GatewayIntentBits.MessageContent);
}

const client = new Client({
    intents: clientIntents,
    partials: [Partials.Channel, Partials.Message, Partials.Reaction, Partials.User],
});

let dailyResetLastSentDateKey = null;
let dailyResetTimer = null;

async function getActiveGuild() {
    const guildId = process.env.GUILD_ID;
    if (guildId) {
        const fetched = await client.guilds.fetch(guildId).catch(() => null);
        if (fetched) return fetched;
    }
    return client.guilds.cache.first() || null;
}

async function findChannelByNames(preferredNames) {
    const guild = await getActiveGuild();
    if (!guild) return null;
    const channels = await guild.channels.fetch().catch(() => null);
    if (!channels) return null;
    for (const name of preferredNames) {
        const match = channels.find((ch) => ch && ch.type === 0 && ch.name === name);
        if (match) return match;
    }
    return null;
}

async function findChannelByIds(preferredIds) {
    const guild = await getActiveGuild();
    if (!guild) return null;
    for (const id of preferredIds || []) {
        if (!id) continue;
        const ch = await guild.channels.fetch(String(id)).catch(() => null);
        if (ch && ch.type === 0) return ch;
    }
    return null;
}

async function findDailyResetChannel() {
    return findChannelByNames(CONFIG.dailyResetReminder.preferredChannelNames);
}

async function findChangelogChannel() {
    const byId = await findChannelByIds(CONFIG.opsChannels.changelogIds);
    if (byId) return byId;
    return findChannelByNames(CONFIG.opsChannels.changelog);
}

async function findDebugChannel() {
    const byId = await findChannelByIds(CONFIG.opsChannels.debugIds);
    if (byId) return byId;
    return findChannelByNames(CONFIG.opsChannels.debug);
}

async function findWelcomeChannel() {
    return findChannelByNames(CONFIG.welcomeChannelNames);
}

async function findRecruitChannel() {
    return findChannelByNames(CONFIG.clanRecruit.preferredChannelNames);
}

async function findReactionRoleChannel() {
    return findChannelByNames(CONFIG.reactionRole.channelNames);
}

async function findRoleByName(roleName) {
    const guild = await getActiveGuild();
    if (!guild) return null;
    const roles = await guild.roles.fetch().catch(() => null);
    if (!roles) return null;
    return roles.find((r) => r && r.name === roleName) || null;
}

async function buildChannelLinkIndex() {
    const guild = await getActiveGuild();
    if (!guild) return new Map();
    const channels = await guild.channels.fetch().catch(() => null);
    if (!channels) return new Map();
    const map = new Map();
    for (const ch of channels.values()) {
        if (ch && ch.type === 0) map.set(ch.name, ch.id);
    }
    return map;
}

function channelMention(name, channelIndex) {
    const id = channelIndex.get(name);
    return id ? `<#${id}>` : `#${name}`;
}

async function sendDebug(content) {
    const channel = await findDebugChannel();
    if (!channel) {
        console.log('Debug post skipped: no debug-log text channel found.');
        return false;
    }
    try {
        if (typeof content === 'string') {
            await channel.send(content);
        } else {
            await channel.send(content);
        }
        return true;
    } catch (error) {
        console.error('Debug post failed:', error.message);
        return false;
    }
}

async function postCurrentChangelog() {
    if (!BOT_CHANGELOG || BOT_CHANGELOG.length === 0) {
        return { posted: false, status: 'no changelog entries for current version' };
    }
    const channel = await findChangelogChannel();
    if (!channel) {
        return { posted: false, status: 'no #changelog channel found in guild' };
    }
    try {
        const recent = await channel.messages.fetch({ limit: 1 });
        const last = recent.first();
        const lastTitle = last?.embeds?.[0]?.title || '';
        if (lastTitle.includes(`v${BOT_VERSION}`)) {
            return { posted: false, status: `v${BOT_VERSION} already posted to #${channel.name}` };
        }
        const embedCount = await postChangelogToChannel(channel, BOT_VERSION, BOT_CHANGELOG);
        return { posted: true, status: `v${BOT_VERSION} posted to #${channel.name} (${embedCount} embed${embedCount === 1 ? '' : 's'})` };
    } catch (error) {
        return { posted: false, status: `changelog post failed: ${error.message}` };
    }
}

async function announceDeployment(changelogStatus) {
    const lines = [
        `🚀 **${APP_NAME} deployed** v${BOT_VERSION}`,
        `📋 ${changelogStatus}`,
        `⏰ ${new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} Pacific`,
    ];
    const ok = await sendDebug({ content: lines.join('\n') });
    if (!ok) console.log(`Deploy announcement (no debug channel): ${lines.join(' | ')}`);
}

async function sendDailyResetReminder() {
    const target = await findDailyResetChannel();
    if (!target) {
        console.log('Daily reset reminder skipped: no target text channel found.');
        return false;
    }
    await target.send(buildDailyResetMessage());
    console.log(`Daily reset reminder sent to #${target.name}`);
    return true;
}

function startDailyResetScheduler() {
    if (!CONFIG.dailyResetReminder.enabled) {
        console.log('Daily reset reminder disabled by config.');
        return;
    }
    if (dailyResetTimer) clearInterval(dailyResetTimer);
    const tick = async () => {
        const now = new Date();
        const parts = getTimePartsInZone(now, CONFIG.dailyResetReminder.timezone);
        if (parts.hour !== CONFIG.dailyResetReminder.hour || parts.minute !== CONFIG.dailyResetReminder.minute) return;
        const dateKey = formatDateKey(parts);
        if (dailyResetLastSentDateKey === dateKey) return;
        try {
            const sent = await sendDailyResetReminder();
            if (sent) dailyResetLastSentDateKey = dateKey;
        } catch (error) {
            console.error('Daily reset reminder failed:', error.message);
        }
    };
    tick();
    dailyResetTimer = setInterval(tick, 30_000);
    console.log(`Daily reset reminder scheduler active (${CONFIG.dailyResetReminder.timezone} @ ${String(CONFIG.dailyResetReminder.hour).padStart(2, '0')}:${String(CONFIG.dailyResetReminder.minute).padStart(2, '0')}).`);
}

async function buildWelcomeEmbed(targetName = null) {
    const channelIndex = await buildChannelLinkIndex();
    const ai = channelMention('elemental-ai', channelIndex);
    const help = channelMention('help-and-questions', channelIndex);
    const events = channelMention('codes-and-events', channelIndex);
    const gameplay = channelMention('gameplay-general', channelIndex);
    const titleSuffix = targetName ? `, ${targetName}` : '';
    return new EmbedBuilder()
        .setTitle(`⚡ Welcome to Tempest${titleSuffix}`)
        .setColor(0x5865f2)
        .setDescription(
            [
                `Glad to have you in the storm. We are an active Legend of Elements community focused on coordinated play, daily discipline, and clan growth.`,
                '',
                '**Start here**',
                `• ${ai} - bot commands and strategy AI`,
                `• ${gameplay} - daily progression and discussion`,
                `• ${events} - codes, events, and timers`,
                `• ${help} - introduce yourself and ask anything`,
                '',
                '**Daily standards**',
                '• Complete your daily class',
                '• Register for clan raid',
                '• Stay active in voice and text',
                '',
                `React with ${CONFIG.reactionRole.emoji} on the opt-in message in ${gameplay} to enable AI access.`,
            ].join('\n')
        )
        .setFooter({ text: `${APP_NAME} - Tempest discipline wins seasons.` })
        .setTimestamp();
}

function buildRecruitEmbed() {
    return new EmbedBuilder()
        .setTitle('⚡ Tempest is Recruiting')
        .setColor(0xffd700)
        .setDescription(
            [
                'Tempest is a competitive Legend of Elements clan. We win seasons through daily discipline and coordinated play.',
                '',
                '**What we offer**',
                '• Active daily community',
                '• Real strategy discussions, not noise',
                '• Coordinated clan raids and events',
                '• Direct access to a Tempest-tuned AI strategy bot',
                '',
                '**Requirements**',
                '• Daily class completion',
                '• Clan raid registration',
                '• Discord activity and respect for officers',
                '',
                'DM an officer or post in `#help-and-questions` to apply.',
            ].join('\n')
        )
        .setFooter({ text: `${APP_NAME} - Clan Recruitment` })
        .setTimestamp();
}

async function sendClanRecruit() {
    const channel = await findRecruitChannel();
    if (!channel) {
        console.log('Recruit post skipped: no recruit channel found.');
        return false;
    }
    try {
        await channel.send({ embeds: [buildRecruitEmbed()] });
        console.log(`Recruit post sent to #${channel.name}`);
        return true;
    } catch (error) {
        console.error('Recruit post failed:', error.message);
        return false;
    }
}

let recruitTimer = null;
let recruitDayCounter = 0;

function startClanRecruitScheduler() {
    if (!CONFIG.clanRecruit.enabled) {
        console.log('Clan recruit scheduler disabled by config.');
        return;
    }
    if (recruitTimer) clearInterval(recruitTimer);
    const dayMs = 24 * 60 * 60 * 1000;
    recruitTimer = setInterval(async () => {
        recruitDayCounter += 1;
        if (recruitDayCounter % CONFIG.clanRecruit.intervalDays === 0) {
            await sendClanRecruit();
        }
    }, dayMs);
    console.log(`Clan recruit scheduler active (every ${CONFIG.clanRecruit.intervalDays} day${CONFIG.clanRecruit.intervalDays === 1 ? '' : 's'}).`);
}

function buildReactionRoleOptInMessage() {
    return [
        `**${CONFIG.reactionRole.roleName} Opt-In**`,
        '',
        `React with ${CONFIG.reactionRole.emoji} below to enable AI access in #elemental-ai.`,
        '',
        'You can remove the reaction at any time to opt out.',
    ].join('\n');
}

async function sendReactionRoleOptInMessage() {
    const channel = await findReactionRoleChannel();
    if (!channel) return { posted: false, status: 'no reaction-role channel found' };
    try {
        const msg = await channel.send({ content: buildReactionRoleOptInMessage() });
        await msg.react(CONFIG.reactionRole.emoji);
        addReactionRoleMessageId(msg.id);
        return { posted: true, status: `posted to #${channel.name} (msg ${msg.id})`, messageId: msg.id };
    } catch (error) {
        return { posted: false, status: `setupreaction failed: ${error.message}` };
    }
}

async function maybeGrantForumTierRole(member, points) {
    try {
        const tier = getForumTierForPoints(points);
        if (!tier?.name) return;
        const role = await findRoleByName(tier.name);
        if (!role) return;
        if (member.roles.cache.has(role.id)) return;
        await member.roles.add(role).catch((e) => console.error(`Forum tier grant failed: ${e.message}`));
        console.log(`Forum tier: granted ${tier.name} to ${member.user?.username || member.id}`);
        await sendDebug({ content: `🎓 Forum tier upgrade: <@${member.id}> reached **${tier.name}** at ${points} pts.` });
    } catch (error) {
        console.error('maybeGrantForumTierRole failed:', error.message);
    }
}

async function checkContributorTierUpgrade(guild, userId, username) {
    const count = getApprovedCountForUser(userId);
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return;
    const tiers = getContributorRoleTiers();
    for (const tier of tiers) {
        if (tier.threshold <= 0) continue;
        if (count < tier.threshold) continue;
        const role = guild.roles.cache.find((r) => r.name === tier.name);
        if (!role) continue;
        if (member.roles.cache.has(role.id)) continue;
        await member.roles.add(role).catch(() => null);
        try {
            await member.send(
                `🎓 You've earned **${tier.name}** with **${count} approved suggestions**.\n\n` +
                `New permissions unlocked in #elemental-ai and knowledge commands.`
            );
        } catch {
            // best effort only
        }
        await sendDebug({ content: `🎓 Contributor tier upgrade: <@${userId}> -> **${tier.name}** (${count} approved).` });
    }
}

async function handleNewMember(member) {
    try {
        const baseRoleName = CONFIG?.roleNames?.base;
        if (baseRoleName) {
            const role = await findRoleByName(baseRoleName);
            if (role && !member.roles.cache.has(role.id)) {
                await member.roles.add(role).catch((e) => console.error(`Could not add base role: ${e.message}`));
            } else if (!role) {
                console.log(`Base role "${baseRoleName}" not found in guild; skipping auto-assign.`);
            }
        }
        const welcomeChannel = await findWelcomeChannel();
        if (welcomeChannel) {
            const embed = await buildWelcomeEmbed(member.user.username);
            await welcomeChannel.send({ content: `<@${member.id}>`, embeds: [embed] }).catch((e) => console.error(`Welcome post failed: ${e.message}`));
        }
        try {
            const dmEmbed = new EmbedBuilder()
                .setTitle(`Welcome to Tempest, ${member.user.username}`)
                .setColor(0x5865f2)
                .setDescription(
                    [
                        'Glad to have you in the storm.',
                        '',
                        'Tempest is an active Legend of Elements clan focused on daily discipline and coordinated play.',
                        '',
                        '**Quick start**',
                        '• Complete your daily class',
                        '• Register for clan raid',
                        `• React ${CONFIG.reactionRole.emoji} on the opt-in message in the server to enable AI access`,
                    ].join('\n')
                )
                .setFooter({ text: `${APP_NAME} - Tempest discipline wins seasons.` });
            await member.send({ embeds: [dmEmbed] });
        } catch {
            console.log(`Welcome DM blocked for ${member.user.username}.`);
        }
        await sendDebug({ content: `👋 Welcome posted for <@${member.id}> (${member.user.username})` });
    } catch (error) {
        console.error('handleNewMember failed:', error.message);
    }
}

// ── AI (Tempest Commander Q&A in #elemental-ai) ────────────────────────

let openai = null;
let aiRuntimeEnabled = CONFIG.ai.enabled !== false;
const aiUserMemory = new Map();
const aiUserLastTextAt = new Map();
const aiUserLastVisionAt = new Map();
const aiAnswerMessageIds = new Set();
const aiQuestionByMessageId = new Map();
let aiTokenSpent = 0;
let aiTokenSpentDateKey = formatDateKey(getTimePartsInZone(new Date(), CONFIG.dailyResetReminder.timezone));

const DEFAULT_AI_PERSONA = [
    'You are Tempest Commander, the strategic AI advisor for the Tempest clan in Legend of Elements.',
    '',
    'Voice:',
    '- Tactical, terse, clan-loyal.',
    '- Lead with the answer in 1-2 sentences. Use bullets for steps.',
    '- If you lack data, say "uncertain" and ask for what you need.',
    '- Never invent numbers, mechanics, or names you do not have.',
    '- Always say "clan", never "guild".',
    '- Avoid emojis, hype, and filler.',
    '',
    'Domain knowledge spans: classes (Wind Swordsman, Thunder Sorcerer, Fire Warrior), realms (Crafting Realm, Mount Realm), Trial Tower, Arena, builds, spirits, relics, mounts, gear, clan systems (Clan Hall, Clan Quests, Clan Events, Clan Vault, Treasure Trove), and rank progression.',
    '',
    'Boundaries:',
    '- Decline non-game questions politely and redirect to the right channel.',
    '- Refuse insults or harassment requests; redirect to community rules.',
].join('\n');

function initOpenAI() {
    if (!process.env.OPENAI_API_KEY) {
        console.log('OpenAI: OPENAI_API_KEY not set; AI Q&A disabled.');
        return;
    }
    try {
        const OpenAIPkg = require('openai');
        const OpenAI = OpenAIPkg.OpenAI || OpenAIPkg.default || OpenAIPkg;
        openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        console.log(`OpenAI initialized (model=${CONFIG.ai.model}, vision=${CONFIG.ai.vision.enabled}).`);
    } catch (error) {
        console.error('OpenAI init failed:', error.message);
    }
}

function isAIChannel(channel) {
    if (!channel) return false;
    if (typeof channel.name !== 'string') return false;
    return CONFIG.ai.channelNames.includes(channel.name);
}

function loadPersonaPrompt() {
    if (CONFIG.ai.persona) return CONFIG.ai.persona;
    try {
        const file = path.join(__dirname, 'docs', 'PERSONA.md');
        if (fs.existsSync(file)) {
            const md = fs.readFileSync(file, 'utf8');
            const stripped = md
                .split('\n')
                .filter((line, idx) => !(idx === 0 && line.startsWith('# ')))
                .join('\n')
                .trim();
            if (stripped.length > 0) return stripped;
        }
    } catch {}
    return DEFAULT_AI_PERSONA;
}

function summarizeKnowledgeForPrompt(maxChars = 2400) {
    const knowledge = loadJson(KNOWLEDGE_PATH, {});
    const parts = [];
    const push = (heading, value) => {
        if (value === undefined || value === null) return;
        if (typeof value === 'string') {
            parts.push(`### ${heading}\n${value}`);
            return;
        }
        if (Array.isArray(value)) {
            const flat = value
                .map((v) => (typeof v === 'string' ? v : JSON.stringify(v)))
                .join('; ');
            parts.push(`### ${heading}\n${flat}`);
            return;
        }
        if (typeof value === 'object') {
            const items = Object.entries(value)
                .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join('; ') : JSON.stringify(v)}`)
                .join('\n');
            parts.push(`### ${heading}\n${items}`);
        }
    };
    for (const [k, v] of Object.entries(knowledge)) {
        if (k === 'custom_facts') continue;
        push(k, v);
    }
    const customFacts = Array.isArray(knowledge.custom_facts) ? knowledge.custom_facts : [];
    if (customFacts.length) {
        const factLines = customFacts
            .slice(-25)
            .map((f) => `- (${f.id}) ${f.text}`)
            .join('\n');
        parts.push(`### custom_facts (latest)\n${factLines}`);
    }
    let combined = parts.join('\n\n');
    if (combined.length > maxChars) combined = combined.slice(0, maxChars - 3) + '...';
    return combined;
}

function getMemory(userId) {
    return aiUserMemory.get(userId) || [];
}

function pushMemory(userId, role, content) {
    const list = aiUserMemory.get(userId) || [];
    list.push({ role, content });
    const limit = CONFIG.ai.memoryTurns * 2;
    while (list.length > limit) list.shift();
    aiUserMemory.set(userId, list);
}

function clearUserMemory(userId) {
    aiUserMemory.delete(userId);
}

function checkDailyTokenBudget() {
    const todayKey = formatDateKey(getTimePartsInZone(new Date(), CONFIG.dailyResetReminder.timezone));
    if (todayKey !== aiTokenSpentDateKey) {
        aiTokenSpent = 0;
        aiTokenSpentDateKey = todayKey;
    }
    return aiTokenSpent < CONFIG.ai.dailyTokenBudget;
}

function recordTokenSpend(usage) {
    if (!usage) return;
    const total = (usage.total_tokens != null) ? usage.total_tokens : ((usage.prompt_tokens || 0) + (usage.completion_tokens || 0));
    aiTokenSpent += total;
}

function memberHasTrustedVisionRole(member) {
    if (!member?.roles?.cache) return false;
    return member.roles.cache.some((r) => CONFIG.ai.vision.trustedRoleNames.includes(r.name));
}

function isOwner(userId) {
    return process.env.OWNER_ID && process.env.OWNER_ID === userId;
}

async function reactWithFeedbackEmojis(message) {
    if (!CONFIG.ai.feedback.enabled) return;
    try {
        await message.react(CONFIG.ai.feedback.thumbsUp);
        await message.react(CONFIG.ai.feedback.thumbsDown);
    } catch (error) {
        console.error('Could not add feedback reactions:', error.message);
    }
}

async function callOpenAIChat(messages, isVision) {
    if (!openai) throw new Error('OpenAI not initialized.');
    const model = isVision ? CONFIG.ai.visionModel : CONFIG.ai.model;
    const response = await openai.chat.completions.create({
        model,
        messages,
        max_tokens: CONFIG.ai.maxTokens,
        temperature: CONFIG.ai.temperature,
    });
    recordTokenSpend(response.usage);
    return response.choices?.[0]?.message?.content?.trim() || '';
}

async function respondWithAI(message) {
    if (!aiRuntimeEnabled) return;
    if (!openai) return;
    if (!hasAIAccess(message.member)) {
        const accessList = CONFIG.ai.accessRoleNames.map((r) => `**${r}**`).join(', ');
        const embed = new EmbedBuilder()
            .setTitle('AI access required')
            .setDescription(
                [
                    'You need an AI-enabled or verified role to ask questions in this channel.',
                    '',
                    `Allowed roles: ${accessList}`,
                    '',
                    `If you should have access, react with ${CONFIG.reactionRole.emoji} on the opt-in message or ask an officer/admin.`,
                ].join('\n')
            )
            .setColor(0xe67e22);
        await message.reply({ embeds: [embed] }).catch(() => null);
        return;
    }
    if (!checkDailyTokenBudget()) {
        await message.reply('Daily AI token budget reached. Resets at midnight Pacific.').catch(() => null);
        return;
    }
    const userId = message.author.id;
    const now = Date.now();
    const lastText = aiUserLastTextAt.get(userId) || 0;
    if (now - lastText < CONFIG.ai.textCooldownMs) {
        const wait = Math.ceil((CONFIG.ai.textCooldownMs - (now - lastText)) / 1000);
        await message.reply(`Cooldown: ${wait}s before your next AI question.`).catch(() => null);
        return;
    }

    const imageAttachments = [...(message.attachments?.values() || [])].filter((a) => typeof a.contentType === 'string' && a.contentType.startsWith('image/'));
    const wantsVision = imageAttachments.length > 0;
    let useVision = false;
    if (wantsVision) {
        if (!CONFIG.ai.vision.enabled) {
            await message.reply('Vision answers are disabled. I will read your text only.').catch(() => null);
        } else if (!memberHasTrustedVisionRole(message.member)) {
            await message.reply('Image questions are limited to officers and admins. I will read your text only.').catch(() => null);
        } else {
            const lastVision = aiUserLastVisionAt.get(userId) || 0;
            if (now - lastVision < CONFIG.ai.visionCooldownMs) {
                const wait = Math.ceil((CONFIG.ai.visionCooldownMs - (now - lastVision)) / 1000);
                await message.reply(`Vision cooldown: ${wait}s before your next image question.`).catch(() => null);
                return;
            }
            useVision = true;
        }
    }

    aiUserLastTextAt.set(userId, now);
    if (useVision) aiUserLastVisionAt.set(userId, now);

    const persona = loadPersonaPrompt();
    const knowledge = summarizeKnowledgeForPrompt();
    const systemContent = [
        persona,
        '',
        'Reference knowledge (do not invent beyond it):',
        knowledge,
    ].join('\n');

    const memory = getMemory(userId);
    const userText = (message.content || '').trim() || '(no text)';
    const userMessage = useVision
        ? {
            role: 'user',
            content: [
                { type: 'text', text: userText },
                ...imageAttachments.slice(0, CONFIG.ai.vision.maxImages).map((a) => ({
                    type: 'image_url',
                    image_url: { url: a.url, detail: CONFIG.ai.vision.detail },
                })),
            ],
        }
        : { role: 'user', content: userText };

    const messages = [
        { role: 'system', content: systemContent },
        ...memory,
        userMessage,
    ];

    try {
        await message.channel.sendTyping();
        const answer = await callOpenAIChat(messages, useVision);
        if (!answer) {
            await message.reply('No response generated. Try rephrasing.').catch(() => null);
            return;
        }
        const safe = answer.length > 1900 ? answer.slice(0, 1900) + '\n...' : answer;
        const sent = await message.reply(safe);
        pushMemory(userId, 'user', userText);
        pushMemory(userId, 'assistant', answer);
        aiAnswerMessageIds.add(sent.id);
        aiQuestionByMessageId.set(sent.id, { userId, question: userText, answer });
        await reactWithFeedbackEmojis(sent);
    } catch (error) {
        console.error('AI response failed:', error.message);
        await sendDebug({ content: `🚨 AI error in #${message.channel?.name || 'unknown'}: ${error.message}` });
        await message.reply(`AI error: ${error.message}`).catch(() => null);
    }
}

function recordFeedback({ messageId, userId, username, emoji, value }) {
    const list = loadJson(FEEDBACK_PATH, []);
    const ctx = aiQuestionByMessageId.get(messageId) || {};
    list.push({
        id: list.length + 1,
        messageId,
        userId,
        username,
        emoji,
        value,
        question: ctx.question || null,
        answer: ctx.answer ? ctx.answer.slice(0, 500) : null,
        at: new Date().toISOString(),
    });
    saveJson(FEEDBACK_PATH, list);
}

async function handleAIThumbsReaction(reaction, user) {
    if (user.bot) return;
    if (!CONFIG.ai.feedback.enabled) return;
    try {
        if (reaction.partial) await reaction.fetch().catch(() => null);
        const messageId = reaction.message.id;
        if (!aiAnswerMessageIds.has(messageId)) return;
        const emoji = reaction.emoji?.name;
        if (emoji !== CONFIG.ai.feedback.thumbsUp && emoji !== CONFIG.ai.feedback.thumbsDown) return;
        recordFeedback({
            messageId,
            userId: user.id,
            username: user.username,
            emoji,
            value: emoji === CONFIG.ai.feedback.thumbsUp ? 1 : -1,
        });
    } catch (error) {
        console.error('handleAIThumbsReaction failed:', error.message);
    }
}

async function handleReactionRoleAdd(reaction, user) {
    if (user.bot) return;
    if (!CONFIG.reactionRole.enabled) return;
    try {
        if (reaction.partial) {
            await reaction.fetch().catch(() => null);
        }
        const messageId = reaction.message.id;
        const tracked = getReactionRoleMessageIds();
        if (!tracked.includes(messageId)) return;
        const emojiName = reaction.emoji?.name;
        if (emojiName !== CONFIG.reactionRole.emoji) return;
        const guild = reaction.message.guild;
        if (!guild) return;
        const role = await findRoleByName(CONFIG.reactionRole.roleName);
        if (!role) {
            console.log(`Reaction-role: role "${CONFIG.reactionRole.roleName}" not found; skipping grant.`);
            return;
        }
        const member = await guild.members.fetch(user.id).catch(() => null);
        if (!member) return;
        if (member.roles.cache.has(role.id)) return;
        await member.roles.add(role).catch((e) => console.error(`Reaction-role grant failed: ${e.message}`));
        console.log(`Reaction-role: granted ${role.name} to ${user.username}`);
    } catch (error) {
        console.error('handleReactionRoleAdd failed:', error.message);
    }
}

async function handleReactionRoleRemove(reaction, user) {
    if (user.bot) return;
    if (!CONFIG.reactionRole.enabled) return;
    try {
        if (reaction.partial) {
            await reaction.fetch().catch(() => null);
        }
        const messageId = reaction.message.id;
        const tracked = getReactionRoleMessageIds();
        if (!tracked.includes(messageId)) return;
        const emojiName = reaction.emoji?.name;
        if (emojiName !== CONFIG.reactionRole.emoji) return;
        const guild = reaction.message.guild;
        if (!guild) return;
        const role = await findRoleByName(CONFIG.reactionRole.roleName);
        if (!role) return;
        const member = await guild.members.fetch(user.id).catch(() => null);
        if (!member) return;
        if (!member.roles.cache.has(role.id)) return;
        await member.roles.remove(role).catch((e) => console.error(`Reaction-role remove failed: ${e.message}`));
        console.log(`Reaction-role: removed ${role.name} from ${user.username}`);
    } catch (error) {
        console.error('handleReactionRoleRemove failed:', error.message);
    }
}

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag} (v${BOT_VERSION})`);
    console.log(`App: ${APP_NAME}${APP_ID ? ` [${APP_ID}]` : ''}`);
    if (!process.env.CLIENT_ID) console.log('Warning: CLIENT_ID is missing; invite/build scripts may fail.');
    if (!process.env.GUILD_ID) console.log('Warning: GUILD_ID is missing; setup scripts cannot target a server.');
    if (MESSAGE_CONTENT_INTENT_ENABLED) {
        console.log('Message Content Intent is enabled. Prefix commands and non-mention AI messages are active.');
    } else {
        console.log('Message Content Intent is disabled (ENABLE_MESSAGE_CONTENT_INTENT != true). Slash commands remain active; prefix/free-text listeners are limited.');
        await sendDebug({
            content:
                '⚠️ AI text warning: `ENABLE_MESSAGE_CONTENT_INTENT` is false. ' +
                'Normal free-text messages in #elemental-ai (e.g. \"hello\") will not trigger bot replies until enabled.',
        });
    }
    if (GUILD_MEMBERS_INTENT_ENABLED) {
        console.log('Guild Members Intent is enabled. Auto-role on join and member-fetch dependent features are active.');
    } else {
        console.log('Guild Members Intent is disabled (ENABLE_GUILD_MEMBERS_INTENT != true). Join-role automation may be limited.');
        await sendDebug({
            content:
                '⚠️ Welcome automation warning: `ENABLE_GUILD_MEMBERS_INTENT` is false. ' +
                'Join-based welcome embeds and auto-role on join will not fire until enabled.',
        });
    }
    await registerGuildSlashCommands();

    const changelogResult = await postCurrentChangelog();
    console.log(`Changelog: ${changelogResult.status}`);
    await announceDeployment(changelogResult.status);

    startDailyResetScheduler();
    startClanRecruitScheduler();
    initOpenAI();
});

client.on('guildMemberAdd', (member) => handleNewMember(member));
client.on('messageReactionAdd', async (reaction, user) => {
    await handleReactionRoleAdd(reaction, user);
    await handleAIThumbsReaction(reaction, user);
});
client.on('messageReactionRemove', (reaction, user) => handleReactionRoleRemove(reaction, user));

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const isCommand = message.content.startsWith('!');
    const isDM = message.channel?.type === 1;
    const isAITextChannel = isAIChannel(message.channel);
    const channelName = message.channel?.name ? String(message.channel.name).toLowerCase() : '';

    // Mirror source-bot behavior: ignore recruit channels for normal handling.
    if (channelName.includes('recruit')) return;

    if (message.guild && isActivityChannel(message.channel) && !isCommand) {
        const newPoints = awardActivityPoint(message.author.id, message.author.username);
        if (newPoints != null && message.member) {
            await maybeGrantForumTierRole(message.member, newPoints);
        }
    }

    // Source parity: outside AI channel + DM, only respond to commands.
    if (!isAITextChannel && !isDM && !isCommand) return;

    if (!isCommand) {
        if (message.guild && isAITextChannel) {
            await respondWithAI(message);
        }
        return;
    }
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

seedDataFiles();
ensureDataFiles();

const app = express();
app.get('/health', (_req, res) =>
    res.status(200).json({
        ok: true,
        version: BOT_VERSION,
        discord: client.isReady() ? 'connected' : 'disconnected',
    })
);
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Health server listening on ${port}`));

const LOGIN_BASE_DELAY_MS = 5_000;
const LOGIN_MAX_DELAY_MS = 60_000;
const LOGIN_MAX_ATTEMPTS = 8;
const FATAL_GATEWAY_CLOSE_CODES = new Set([4004, 4010, 4011, 4013, 4014]);
let loginAttemptCount = 0;
let loginInFlight = false;
let pendingLoginTimer = null;

function isFatalLoginError(error) {
    const msg = String(error?.message || '').toLowerCase();
    return (
        msg.includes('token') ||
        msg.includes('used disallowed intents') ||
        msg.includes('disallowed intents') ||
        msg.includes('invalid intents') ||
        msg.includes('sharding is required')
    );
}

function scheduleLoginRetry(reason) {
    if (pendingLoginTimer) clearTimeout(pendingLoginTimer);
    if (loginAttemptCount >= LOGIN_MAX_ATTEMPTS) {
        console.error(
            `Discord login failed ${loginAttemptCount} times (${reason}). ` +
            'Stopping process to avoid reconnect spam. Fix env/config and redeploy.'
        );
        process.exit(1);
    }
    const backoff = Math.min(LOGIN_BASE_DELAY_MS * (2 ** (loginAttemptCount - 1)), LOGIN_MAX_DELAY_MS);
    const jitter = Math.floor(Math.random() * 500);
    const delay = backoff + jitter;
    console.error(
        `Discord login attempt ${loginAttemptCount} failed (${reason}). ` +
        `Retrying in ${Math.round(delay / 1000)}s.`
    );
    pendingLoginTimer = setTimeout(() => {
        pendingLoginTimer = null;
        loginWithRetry();
    }, delay);
}

async function loginWithRetry() {
    if (!process.env.DISCORD_TOKEN) {
        console.error('Missing DISCORD_TOKEN. Refusing to run disconnected.');
        process.exit(1);
    }
    if (client.isReady()) return;
    if (loginInFlight) return;
    loginInFlight = true;
    loginAttemptCount += 1;
    try {
        await client.login(process.env.DISCORD_TOKEN);
        loginAttemptCount = 0;
    } catch (error) {
        if (isFatalLoginError(error)) {
            console.error(
                `Fatal Discord login error (${error.message}). ` +
                'Stopping process to avoid connection spam. Update bot token/intents and restart.'
            );
            process.exit(1);
        }
        scheduleLoginRetry(error.message || 'unknown login error');
    } finally {
        loginInFlight = false;
    }
}

client.on('shardDisconnect', (event, shardId) => {
    const code = Number(event?.code);
    if (!Number.isFinite(code)) return;
    if (!FATAL_GATEWAY_CLOSE_CODES.has(code)) return;
    console.error(
        `Fatal Discord gateway close code ${code} on shard ${shardId}. ` +
        'Stopping process to prevent reconnect loops. Check token/intents/sharding config.'
    );
    process.exit(1);
});

loginWithRetry();
