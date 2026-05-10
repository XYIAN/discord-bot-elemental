#!/usr/bin/env node
const path = require('path');
require('dotenv').config();
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local'), override: false });

const { getEnv, fetchGuildRoles, discordRequest } = require('./lib/discord-api');
const { loadBootstrapConfig } = require('./lib/bootstrap-config');

const isDryRun = process.argv.includes('--dry-run');

async function main() {
    const { token, guildId } = getEnv();
    const config = loadBootstrapConfig();
    const roles = await fetchGuildRoles(token, guildId);
    const existing = new Set(roles.map((r) => r.name));

    const desired = [
        config.roleNames.base,
        config.clanRoleNames.verified,
        config.clanRoleNames.officer,
        ...config.activityTiers.map((t) => t.name),
        ...((config.forumRoleTiers || []).map((t) => t.name)),
        config?.reactionRole?.roleName,
    ].filter(Boolean);

    console.log(`Guild ${guildId}: ${roles.length} existing roles`);

    for (const roleName of desired) {
        if (existing.has(roleName)) {
            console.log(`= exists: ${roleName}`);
            continue;
        }
        if (isDryRun) {
            console.log(`+ dry-run create: ${roleName}`);
            continue;
        }
        await discordRequest('POST', `/guilds/${guildId}/roles`, token, {
            name: roleName,
            permissions: '0',
            mentionable: true,
            hoist: false,
        });
        console.log(`+ created: ${roleName}`);
    }
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
