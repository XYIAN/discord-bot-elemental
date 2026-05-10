#!/usr/bin/env node
const path = require('path');
require('dotenv').config();
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local'), override: false });

const { getEnv, fetchGuildChannels, discordRequest } = require('./lib/discord-api');
const { loadBootstrapConfig } = require('./lib/bootstrap-config');

const isDryRun = process.argv.includes('--dry-run');

async function ensureCategory(token, guildId, channels, categoryName) {
    const existing = channels.find((c) => c.type === 4 && c.name === categoryName);
    if (existing) return existing;
    if (isDryRun) {
        console.log(`+ dry-run create category: ${categoryName}`);
        return { id: `dry-${categoryName}`, name: categoryName, type: 4 };
    }
    const created = await discordRequest('POST', `/guilds/${guildId}/channels`, token, {
        name: categoryName,
        type: 4,
    });
    console.log(`+ created category: ${categoryName}`);
    return created;
}

async function ensureTextChannel(token, guildId, channels, name, parentId) {
    const existing = channels.find((c) => c.type === 0 && c.name === name && c.parent_id === parentId);
    if (existing) return existing;
    if (isDryRun) {
        console.log(`+ dry-run create channel: #${name} (parent ${parentId})`);
        return { id: `dry-${name}`, name, type: 0, parent_id: parentId };
    }
    const created = await discordRequest('POST', `/guilds/${guildId}/channels`, token, {
        name,
        type: 0,
        parent_id: parentId,
    });
    console.log(`+ created channel: #${name}`);
    return created;
}

async function main() {
    const { token, guildId } = getEnv();
    const config = loadBootstrapConfig();
    const channels = await fetchGuildChannels(token, guildId);

    for (const cat of config.channelBlueprint.publicCategories || []) {
        const category = await ensureCategory(token, guildId, channels, cat.name);
        for (const channelName of cat.channels || []) {
            await ensureTextChannel(token, guildId, channels, channelName, category.id);
        }
    }

    const clanCatName = config.channelBlueprint.privateClanCategory?.name;
    const clanChannels = config.channelBlueprint.privateClanCategory?.channels || [];
    if (clanCatName) {
        const clanCategory = await ensureCategory(token, guildId, channels, clanCatName);
        for (const channelName of clanChannels) {
            await ensureTextChannel(token, guildId, channels, channelName, clanCategory.id);
        }
    }
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
