#!/usr/bin/env node
const path = require('path');
require('dotenv').config();
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local'), override: false });

const { getEnv, fetchGuildRoles, fetchGuildChannels, discordRequest } = require('./lib/discord-api');
const { loadBootstrapConfig } = require('./lib/bootstrap-config');

const isDryRun = process.argv.includes('--dry-run');

// Permission bits:
// VIEW_CHANNEL = 1024
// SEND_MESSAGES = 2048
const ALLOW_VIEW_SEND = (1024n | 2048n).toString();
const DENY_VIEW = (1024n).toString();

function buildOverwrites(guildId, verifiedRoleId, officerRoleId) {
    return [
        { id: guildId, type: 0, deny: DENY_VIEW, allow: '0' }, // @everyone
        { id: verifiedRoleId, type: 0, allow: ALLOW_VIEW_SEND, deny: '0' },
        { id: officerRoleId, type: 0, allow: ALLOW_VIEW_SEND, deny: '0' },
    ];
}

async function patchChannel(token, channelId, overwritePayload) {
    return discordRequest('PATCH', `/channels/${channelId}`, token, {
        permission_overwrites: overwritePayload,
    });
}

async function main() {
    const { token, guildId } = getEnv();
    const config = loadBootstrapConfig();
    const roles = await fetchGuildRoles(token, guildId);
    const channels = await fetchGuildChannels(token, guildId);

    const verified = roles.find((r) => r.name === config.clanRoleNames.verified);
    const officer = roles.find((r) => r.name === config.clanRoleNames.officer);
    if (!verified || !officer) {
        throw new Error('Missing required clan roles. Run scripts/create-roles.js first.');
    }

    const clanCategoryName = config.channelBlueprint.privateClanCategory.name;
    const clanCategory = channels.find((c) => c.type === 4 && c.name === clanCategoryName);
    if (!clanCategory) throw new Error(`Missing clan category: ${clanCategoryName}`);

    const privateTargets = channels.filter(
        (c) => c.id === clanCategory.id || c.parent_id === clanCategory.id
    );

    const baseOverwrites = buildOverwrites(guildId, verified.id, officer.id);
    const officerOnlyName = 'officer-planning';

    for (const target of privateTargets) {
        let overwrites = baseOverwrites;
        if (target.name === officerOnlyName) {
            overwrites = [
                { id: guildId, type: 0, deny: DENY_VIEW, allow: '0' },
                { id: officer.id, type: 0, allow: ALLOW_VIEW_SEND, deny: '0' },
            ];
        }

        if (isDryRun) {
            console.log(`~ dry-run patch permissions: ${target.name} (${target.id})`);
            continue;
        }
        await patchChannel(token, target.id, overwrites);
        console.log(`~ patched permissions: ${target.name}`);
    }
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
