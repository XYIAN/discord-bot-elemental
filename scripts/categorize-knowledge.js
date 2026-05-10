#!/usr/bin/env node
/**
 * Categorize custom_facts in data/knowledge.json by inferred topic.
 *
 * What it does:
 * - Reads knowledge.json from DATA_VOLUME_PATH (or repo data/).
 * - Tags each fact with one or more category labels based on keyword matches.
 * - Prints a per-category bucket count and the IDs in each bucket.
 * - With --apply, writes the inferred `categories` field back onto each fact
 *   (overwrites existing `categories` only if --force is also passed).
 * - With --dry-run (default), only reports.
 *
 * Run with:
 *   node scripts/categorize-knowledge.js              # report
 *   node scripts/categorize-knowledge.js --apply      # write back tags
 *   node scripts/categorize-knowledge.js --apply --force  # overwrite existing
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const DATA_DIR = process.env.DATA_VOLUME_PATH || path.join(REPO_ROOT, 'data');
const KNOWLEDGE_PATH = path.join(DATA_DIR, 'knowledge.json');

const apply = process.argv.includes('--apply');
const force = process.argv.includes('--force');

const RULES = [
    { category: 'classes', keywords: ['swordsman', 'sorcerer', 'warrior', 'class', 'wind', 'thunder', 'fire'] },
    { category: 'realms', keywords: ['crafting realm', 'mount realm', 'realm'] },
    { category: 'arena', keywords: ['arena', 'pvp', 'rumble', 'peak'] },
    { category: 'trial-tower', keywords: ['trial tower', 'tower'] },
    { category: 'builds', keywords: ['build', 'refine', 'gear', 'blacksmith', 'outfit'] },
    { category: 'spirits-and-relics', keywords: ['spirit', 'relic'] },
    { category: 'mounts', keywords: ['mount', 'soulvine'] },
    { category: 'clan', keywords: ['clan', 'tempest', 'raid', 'vault', 'treasure trove', 'chancellor', 'marshal', 'rank'] },
    { category: 'events-codes', keywords: ['event', 'code', 'season', 'limited'] },
    { category: 'stats', keywords: ['speed', 'crit', 'damage', 'attack', 'health', 'dmg'] },
    { category: 'progression', keywords: ['ascension', 'level', 'tier', 'unlock'] },
];

function categorize(text) {
    const t = text.toLowerCase();
    const hits = new Set();
    for (const rule of RULES) {
        if (rule.keywords.some((kw) => t.includes(kw))) hits.add(rule.category);
    }
    if (hits.size === 0) hits.add('uncategorized');
    return [...hits];
}

function main() {
    if (!fs.existsSync(KNOWLEDGE_PATH)) {
        console.error(`Knowledge file not found: ${KNOWLEDGE_PATH}`);
        process.exit(1);
    }
    let knowledge;
    try {
        knowledge = JSON.parse(fs.readFileSync(KNOWLEDGE_PATH, 'utf8'));
    } catch (e) {
        console.error(`Could not parse knowledge.json: ${e.message}`);
        process.exit(1);
    }
    const facts = Array.isArray(knowledge.custom_facts) ? knowledge.custom_facts : [];
    if (!facts.length) {
        console.log('No custom_facts to categorize.');
        return;
    }

    const buckets = new Map();
    let applied = 0;
    let skipped = 0;
    for (const f of facts) {
        const text = typeof f.text === 'string' ? f.text : '';
        const cats = categorize(text);
        for (const c of cats) {
            const list = buckets.get(c) || [];
            list.push(f.id);
            buckets.set(c, list);
        }
        if (apply) {
            if (Array.isArray(f.categories) && f.categories.length && !force) {
                skipped += 1;
                continue;
            }
            f.categories = cats;
            applied += 1;
        }
    }

    console.log('=== Category buckets ===');
    const sorted = [...buckets.entries()].sort((a, b) => b[1].length - a[1].length);
    for (const [cat, ids] of sorted) {
        console.log(`- ${cat} (${ids.length}): ${ids.slice(0, 20).join(', ')}${ids.length > 20 ? '…' : ''}`);
    }

    if (apply) {
        knowledge.custom_facts = facts;
        fs.writeFileSync(KNOWLEDGE_PATH, JSON.stringify(knowledge, null, 2));
        console.log(`\nApplied to ${applied} facts (skipped ${skipped} that already had categories; pass --force to overwrite).`);
        console.log(`Wrote ${KNOWLEDGE_PATH}`);
    } else {
        console.log('\n(dry-run) no changes written. Pass --apply to write categories back onto each fact.');
    }
}

main();
