#!/usr/bin/env node
const path = require('path');
require('dotenv').config();
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local'), override: false });
const { PermissionsBitField } = require('discord.js');

const { getEnv, fetchGuildRoles, discordRequest } = require('./lib/discord-api');
const { loadBootstrapConfig } = require('./lib/bootstrap-config');

const isDryRun = process.argv.includes('--dry-run');

function toPermString(flags = []) {
    if (!flags.length) return '0';
    let value = 0n;
    for (const flag of flags) value |= BigInt(flag);
    return value.toString();
}

function buildRoleSpec(config, roleName) {
    const spec = {
        name: roleName,
        permissions: '0',
        mentionable: true,
        hoist: false,
        color: 0,
    };

    const styleByName = {
        [config.roleNames.base]: { color: 0x95a5a6 }, // neutral gray
        [config.clanRoleNames.verified]: { color: 0x57f287 }, // green
        [config.clanRoleNames.officer]: {
            color: 0xffa500, // orange
            hoist: true,
            permissions: toPermString([
                PermissionsBitField.Flags.ManageMessages,
                PermissionsBitField.Flags.ModerateMembers,
            ]),
        },
        Admin: {
            color: 0xed4245, // red
            hoist: true,
            permissions: toPermString([PermissionsBitField.Flags.Administrator]),
        },
        Moderator: {
            color: 0xfee75c, // yellow
            hoist: true,
            permissions: toPermString([
                PermissionsBitField.Flags.KickMembers,
                PermissionsBitField.Flags.BanMembers,
                PermissionsBitField.Flags.ModerateMembers,
                PermissionsBitField.Flags.ManageMessages,
                PermissionsBitField.Flags.ViewAuditLog,
            ]),
        },
        [config?.reactionRole?.roleName]: { color: 0x5865f2 }, // blurple
        'Tempest High Rank 3': { color: 0x3498db },
        'Tempest High Rank 2': { color: 0x1abcfe },
        'Tempest High Rank 1': { color: 0x00e5ff },
        'Tempest Left Marshal': { color: 0x00ffff }, // bright cyan requested
        'Tempest Scribe': { color: 0x9b59b6 },
        'Tempest Loremaster': { color: 0xe91e63 },
        'Tempest Archivist': { color: 0xffffff, hoist: true },
    };

    return { ...spec, ...(styleByName[roleName] || {}) };
}

function needsUpdate(role, spec) {
    return (
        role.color !== spec.color ||
        role.hoist !== spec.hoist ||
        role.mentionable !== spec.mentionable ||
        String(role.permissions) !== String(spec.permissions)
    );
}

async function main() {
    const { token, guildId } = getEnv();
    const config = loadBootstrapConfig();
    const roles = await fetchGuildRoles(token, guildId);
    const existingByName = new Map(roles.map((r) => [r.name, r]));

    const desired = [
        config.roleNames.base,
        config.clanRoleNames.verified,
        config.clanRoleNames.officer,
        ...(config.adminRoleNames || []),
        ...config.activityTiers.map((t) => t.name),
        ...((config.forumRoleTiers || []).map((t) => t.name)),
        config?.reactionRole?.roleName,
    ].filter(Boolean);

    console.log(`Guild ${guildId}: ${roles.length} existing roles`);

    for (const roleName of [...new Set(desired)]) {
        const spec = buildRoleSpec(config, roleName);
        const existing = existingByName.get(roleName);
        if (existing) {
            if (!needsUpdate(existing, spec)) {
                console.log(`= up-to-date: ${roleName}`);
                continue;
            }
            if (isDryRun) {
                console.log(`~ dry-run update: ${roleName}`);
                continue;
            }
            await discordRequest('PATCH', `/guilds/${guildId}/roles/${existing.id}`, token, {
                color: spec.color,
                hoist: spec.hoist,
                mentionable: spec.mentionable,
                permissions: spec.permissions,
            });
            console.log(`~ updated: ${roleName}`);
            continue;
        }
        if (isDryRun) {
            console.log(`+ dry-run create: ${roleName}`);
            continue;
        }
        await discordRequest('POST', `/guilds/${guildId}/roles`, token, {
            name: spec.name,
            color: spec.color,
            permissions: spec.permissions,
            mentionable: spec.mentionable,
            hoist: spec.hoist,
        });
        console.log(`+ created: ${roleName}`);
    }
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
