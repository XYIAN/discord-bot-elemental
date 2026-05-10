#!/usr/bin/env node
/**
 * Snapshot data files into a timestamped folder.
 * Run with: npm run backup:data
 *
 * Output: data-backups/<UTC ISO>/{knowledge,suggestions,opinions,activity,feedback,reaction-role}.json
 *
 * Pair with the runbook in docs/BACKUP-STRATEGY.md to commit and push to a
 * `backup/data` branch on a cadence, or upload to S3.
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const DATA_DIR = process.env.DATA_VOLUME_PATH || path.join(REPO_ROOT, 'data');
const BACKUP_ROOT = path.join(REPO_ROOT, 'data-backups');

const FILES = [
    'knowledge.json',
    'suggestions.json',
    'opinions.json',
    'activity.json',
    'feedback.json',
    'reaction-role.json',
];

function timestamp() {
    return new Date().toISOString().replace(/[:.]/g, '-');
}

function main() {
    if (!fs.existsSync(DATA_DIR)) {
        console.error(`Data dir not found: ${DATA_DIR}`);
        process.exit(1);
    }
    if (!fs.existsSync(BACKUP_ROOT)) fs.mkdirSync(BACKUP_ROOT, { recursive: true });
    const target = path.join(BACKUP_ROOT, timestamp());
    fs.mkdirSync(target, { recursive: true });
    let copied = 0;
    let missing = 0;
    for (const name of FILES) {
        const src = path.join(DATA_DIR, name);
        const dst = path.join(target, name);
        if (fs.existsSync(src)) {
            fs.copyFileSync(src, dst);
            copied += 1;
            console.log(`+ copied ${name}`);
        } else {
            missing += 1;
            console.log(`- missing ${name} (skipped)`);
        }
    }
    console.log(`\nBackup written to ${target}`);
    console.log(`Files copied: ${copied}, skipped (not present): ${missing}`);
}

main();
