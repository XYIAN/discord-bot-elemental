#!/usr/bin/env node
/**
 * Audit script for Tempest Commander AI setup.
 *
 * Validates that the live Discord guild + repo state is sufficient to run
 * the bot in #elemental-ai with the full Tempest Commander persona.
 * Run with: npm run audit:ai
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local'), override: false });

const { getEnv, fetchGuildRoles, fetchGuildChannels } = require('./lib/discord-api');
const { loadBootstrapConfig } = require('./lib/bootstrap-config');

const REPO_ROOT = path.join(__dirname, '..');
const DATA_DIR = process.env.DATA_VOLUME_PATH || path.join(REPO_ROOT, 'data');

const ICONS = { ok: '✅', warn: '⚠️ ', fail: '❌' };

function check(level, label, detail) {
    const icon = ICONS[level] || '?';
    const tail = detail ? ` - ${detail}` : '';
    console.log(`${icon} ${label}${tail}`);
    return level;
}

function fileExistsAndNonEmpty(p) {
    try {
        const stat = fs.statSync(p);
        return stat.size > 0;
    } catch {
        return false;
    }
}

async function main() {
    let warnings = 0;
    let failures = 0;
    const bump = (level) => {
        if (level === 'warn') warnings += 1;
        if (level === 'fail') failures += 1;
    };

    console.log('=== Tempest Commander AI Audit ===\n');

    let token, guildId;
    try {
        ({ token, guildId } = getEnv());
        bump(check('ok', 'env: DISCORD_TOKEN + GUILD_ID present'));
    } catch (e) {
        bump(check('fail', 'env: DISCORD_TOKEN/GUILD_ID', e.message));
        console.log('\nCannot continue without env. Aborting.');
        process.exit(1);
    }

    bump(check(process.env.CLIENT_ID ? 'ok' : 'warn', 'env: CLIENT_ID', process.env.CLIENT_ID ? 'present' : 'missing - slash command registration disabled'));
    bump(check(process.env.OPENAI_API_KEY ? 'ok' : 'warn', 'env: OPENAI_API_KEY', process.env.OPENAI_API_KEY ? 'present' : 'missing - AI Q&A disabled'));
    bump(check(process.env.OWNER_ID ? 'ok' : 'warn', 'env: OWNER_ID', process.env.OWNER_ID ? 'present' : 'missing - !ai on/off owner gate disabled'));
    bump(check(process.env.DATA_VOLUME_PATH ? 'ok' : 'warn', 'env: DATA_VOLUME_PATH', process.env.DATA_VOLUME_PATH || 'unset - data files will not survive Railway redeploy'));

    const config = loadBootstrapConfig();

    const personaPath = path.join(REPO_ROOT, 'docs', 'PERSONA.md');
    bump(check(fileExistsAndNonEmpty(personaPath) ? 'ok' : 'fail', 'persona: docs/PERSONA.md', fileExistsAndNonEmpty(personaPath) ? `${fs.statSync(personaPath).size} bytes` : 'missing or empty'));

    const knowledgePath = path.join(DATA_DIR, 'knowledge.json');
    if (fileExistsAndNonEmpty(knowledgePath)) {
        try {
            const k = JSON.parse(fs.readFileSync(knowledgePath, 'utf8'));
            const facts = Array.isArray(k.custom_facts) ? k.custom_facts.length : 0;
            bump(check('ok', 'knowledge: data/knowledge.json', `loaded; ${facts} custom facts`));
        } catch (e) {
            bump(check('fail', 'knowledge: data/knowledge.json', `unparseable JSON: ${e.message}`));
        }
    } else {
        bump(check('fail', 'knowledge: data/knowledge.json', 'missing or empty'));
    }

    let roles = [];
    let channels = [];
    try {
        roles = await fetchGuildRoles(token, guildId);
        bump(check('ok', `guild: ${guildId}`, `${roles.length} roles fetched`));
    } catch (e) {
        bump(check('fail', `guild roles fetch`, e.message));
    }
    try {
        channels = await fetchGuildChannels(token, guildId);
        bump(check('ok', `guild channels`, `${channels.length} channels fetched`));
    } catch (e) {
        bump(check('fail', `guild channels fetch`, e.message));
    }

    const channelExists = (name) => channels.some((c) => c.type === 0 && c.name === name);
    const roleExists = (name) => roles.some((r) => r.name === name);

    const aiChannelNames = config?.ai?.channelNames || ['elemental-ai'];
    for (const name of aiChannelNames) {
        bump(check(channelExists(name) ? 'ok' : 'fail', `channel: #${name}`, channelExists(name) ? 'exists' : 'missing - bot will not respond to AI questions'));
    }

    const opsCheck = (group, list) => {
        for (const name of list) {
            bump(check(channelExists(name) ? 'ok' : 'warn', `channel (${group}): #${name}`, channelExists(name) ? 'exists' : 'missing - feature degraded'));
        }
    };
    opsCheck('changelog', config?.opsChannels?.changelog || ['changelog']);
    opsCheck('debug', config?.opsChannels?.debug || ['debug-log']);
    opsCheck('welcome', config?.welcomeChannelNames || ['gameplay-general']);
    opsCheck('reset', config?.dailyResetReminder?.preferredChannelNames || ['gameplay-general']);
    opsCheck('recruit', config?.clanRecruit?.preferredChannelNames || ['gameplay-general']);
    opsCheck('ai-optin', config?.reactionRole?.channelNames || ['gameplay-general']);

    const baseRole = config?.roleNames?.base;
    if (baseRole) bump(check(roleExists(baseRole) ? 'ok' : 'warn', `role (base): ${baseRole}`, roleExists(baseRole) ? 'exists' : 'missing - guildMemberAdd skip'));

    const reactionRoleName = config?.reactionRole?.roleName;
    if (reactionRoleName) bump(check(roleExists(reactionRoleName) ? 'ok' : 'warn', `role (AI opt-in): ${reactionRoleName}`, roleExists(reactionRoleName) ? 'exists' : 'missing - reaction will no-op'));

    const tierRoles = (config?.activityTiers || []).map((t) => t.name).filter(Boolean);
    for (const name of tierRoles) {
        bump(check(roleExists(name) ? 'ok' : 'warn', `role (activity): ${name}`, roleExists(name) ? 'exists' : 'missing'));
    }

    const forumRoles = (config?.forumRoleTiers || []).map((t) => t.name).filter(Boolean);
    for (const name of forumRoles) {
        bump(check(roleExists(name) ? 'ok' : 'warn', `role (forum): ${name}`, roleExists(name) ? 'exists' : 'missing - moderation gating broken'));
    }

    const trustedVision = config?.ai?.vision?.trustedRoleNames || [];
    for (const name of trustedVision) {
        bump(check(roleExists(name) ? 'ok' : 'warn', `role (vision-trusted): ${name}`, roleExists(name) ? 'exists' : 'missing - no one can use vision in this server'));
    }

    console.log('\n=== Summary ===');
    console.log(`failures: ${failures}`);
    console.log(`warnings: ${warnings}`);
    if (failures > 0) {
        console.log('\nAudit FAILED. Resolve failures above before launch.');
        process.exit(1);
    } else if (warnings > 0) {
        console.log('\nAudit passed with warnings. Review above for degraded features.');
        process.exit(0);
    } else {
        console.log('\nAudit passed cleanly. Tempest Commander is launch-ready.');
        process.exit(0);
    }
}

main().catch((err) => {
    console.error('Audit script crashed:', err.message);
    process.exit(1);
});
