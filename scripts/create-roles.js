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

    // Enforce a readable hierarchy so admin/mod/officer and progression tiers
    // appear in a stable, high-contrast order for members.
    const refreshedRoles = await fetchGuildRoles(token, guildId);
    const byName = new Map(refreshedRoles.map((r) => [r.name, r]));
    const forumTopDown = [...(config.forumRoleTiers || [])]
        .sort((a, b) => (b.threshold || 0) - (a.threshold || 0))
        .map((t) => t.name);
    const activityTopDown = [...(config.activityTiers || [])]
        .sort((a, b) => (b.threshold || 0) - (a.threshold || 0))
        .map((t) => t.name);

    const preferredTopDown = [
        'Admin',
        'Moderator',
        config.clanRoleNames.officer,
        ...forumTopDown,
        ...activityTopDown,
        config.clanRoleNames.verified,
        config?.reactionRole?.roleName,
        config.roleNames.base,
    ].filter(Boolean);

    const managedIds = new Set(refreshedRoles.filter((r) => r.managed).map((r) => r.id));
    const botRole = refreshedRoles.find((r) => r.tags?.bot_id === process.env.CLIENT_ID);
    const botRolePosition = Number(botRole?.position || 0);
    const reorderCandidates = preferredTopDown
        .map((name) => byName.get(name))
        .filter((r) => r && !managedIds.has(r.id));
    const reorderTargets = reorderCandidates.filter((r) => Number(r.position) < botRolePosition);

    if (!reorderTargets.length && reorderCandidates.length) {
        const warning = (
            `Role reorder skipped: bot role "${botRole?.name || 'unknown'}" is at position ${botRolePosition}, ` +
            'so no target roles are below it. Move the bot role higher in Server Settings > Roles, then rerun setup:roles.'
        );
        console.log(`! ${warning}`);
        return;
    }

    if (reorderTargets.length) {
        // Discord higher numeric position = higher in role list.
        const payload = reorderTargets.map((role, idx) => ({
            id: role.id,
            position: reorderTargets.length - idx + 1,
        }));
        if (isDryRun) {
            console.log('~ dry-run reorder hierarchy:');
            for (const [idx, role] of reorderTargets.entries()) {
                console.log(`  ${idx + 1}. ${role.name}`);
            }
        } else {
            await discordRequest('PATCH', `/guilds/${guildId}/roles`, token, payload);
            console.log('~ updated role hierarchy order');
        }
    }
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
