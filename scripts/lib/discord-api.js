const https = require('https');

function getEnv() {
    const token = process.env.DISCORD_TOKEN;
    const guildId = process.env.GUILD_ID;
    if (!token) throw new Error('Missing DISCORD_TOKEN in environment.');
    if (!guildId) throw new Error('Missing GUILD_ID in environment.');
    return { token, guildId };
}

function discordRequest(method, path, token, body = null) {
    return new Promise((resolve, reject) => {
        const payload = body ? JSON.stringify(body) : null;
        const req = https.request(
            {
                hostname: 'discord.com',
                path: `/api/v10${path}`,
                method,
                headers: {
                    Authorization: `Bot ${token}`,
                    'Content-Type': 'application/json',
                },
            },
            (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    const parsed = data ? JSON.parse(data) : null;
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(parsed);
                    } else {
                        reject(new Error(`${method} ${path} failed (${res.statusCode}): ${data}`));
                    }
                });
            }
        );
        req.on('error', reject);
        if (payload) req.write(payload);
        req.end();
    });
}

async function fetchGuildRoles(token, guildId) {
    return discordRequest('GET', `/guilds/${guildId}/roles`, token);
}

async function fetchGuildChannels(token, guildId) {
    return discordRequest('GET', `/guilds/${guildId}/channels`, token);
}

module.exports = {
    getEnv,
    discordRequest,
    fetchGuildRoles,
    fetchGuildChannels,
};
