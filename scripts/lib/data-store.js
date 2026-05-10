const fs = require('fs');
const path = require('path');

const FILE_NAMES = {
    knowledge: 'knowledge.json',
    suggestions: 'suggestions.json',
    activity: 'activity.json',
    feedback: 'feedback.json',
    opinions: 'opinions.json',
    reactionRole: 'reaction-role.json',
};

const SUGGESTION_STATUSES = ['pending', 'approved', 'rejected', 'granted'];

function nextId(list) {
    if (!Array.isArray(list) || list.length === 0) return 1;
    return Math.max(0, ...list.map((x) => Number(x?.id) || 0)) + 1;
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

function defaultDataPath(repoRoot, dataDirEnvOverride) {
    if (dataDirEnvOverride) return dataDirEnvOverride;
    return path.join(repoRoot, 'data');
}

module.exports = {
    FILE_NAMES,
    SUGGESTION_STATUSES,
    nextId,
    loadJson,
    saveJson,
    defaultDataPath,
};
