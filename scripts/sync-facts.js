#!/usr/bin/env node
/**
 * Sync / dedupe / repair custom_facts in data/knowledge.json.
 *
 * What it does:
 * - Loads knowledge.json from DATA_VOLUME_PATH (or repo data/).
 * - Re-numbers any missing/duplicate `id` fields to be unique and stable.
 * - Removes exact-duplicate fact texts (case-insensitive), keeping the oldest.
 * - Trims whitespace from `text`.
 * - Writes the result back (skipped if --dry-run).
 *
 * Run with:
 *   node scripts/sync-facts.js              # apply
 *   node scripts/sync-facts.js --dry-run    # report only
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const DATA_DIR = process.env.DATA_VOLUME_PATH || path.join(REPO_ROOT, 'data');
const KNOWLEDGE_PATH = path.join(DATA_DIR, 'knowledge.json');

const isDryRun = process.argv.includes('--dry-run');

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
    const before = facts.length;

    const trimmed = facts
        .filter((f) => f && typeof f === 'object')
        .map((f) => ({ ...f, text: typeof f.text === 'string' ? f.text.trim() : '' }))
        .filter((f) => f.text.length > 0);

    const seen = new Map();
    const deduped = [];
    let removed = 0;
    for (const f of trimmed) {
        const key = f.text.toLowerCase();
        if (seen.has(key)) {
            removed += 1;
            continue;
        }
        seen.set(key, true);
        deduped.push(f);
    }

    const seenIds = new Set();
    let renumbered = 0;
    for (const f of deduped) {
        const idNum = Number(f.id);
        if (!Number.isInteger(idNum) || idNum <= 0 || seenIds.has(idNum)) {
            const max = seenIds.size ? Math.max(...seenIds) : 0;
            f.id = max + 1;
            renumbered += 1;
        }
        seenIds.add(Number(f.id));
    }

    const after = deduped.length;
    console.log(`facts: ${before} -> ${after} (removed dupes/empties: ${before - after})`);
    console.log(`renumbered ids: ${renumbered}`);
    console.log(`removed exact-duplicate texts: ${removed}`);

    if (isDryRun) {
        console.log('\n(dry-run) no changes written.');
        return;
    }

    knowledge.custom_facts = deduped;
    fs.writeFileSync(KNOWLEDGE_PATH, JSON.stringify(knowledge, null, 2));
    console.log(`\nWrote ${KNOWLEDGE_PATH}`);
}

main();
