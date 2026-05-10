# Backup Strategy

The bot's mutable state lives in `data/*.json` (knowledge, suggestions, opinions, activity, feedback, reaction-role). On Railway, that data only persists if `DATA_VOLUME_PATH` is set to a mounted volume.

This doc lays out three backup paths in increasing operational weight. Pick one and stick to it.

## Path A: Manual snapshots to repo (default for v1.0.0)

Use the bundled script:

```bash
npm run backup:data
```

What it does:

- Reads from `DATA_VOLUME_PATH` if set, else from local `data/`.
- Writes a timestamped folder under `data-backups/<UTC ISO>/`.
- Skips files that do not exist (no failure).

Cadence:

- Run weekly before any large knowledge edit pass.
- Commit `data-backups/<timestamp>/` to a `backup/data` branch:

  ```bash
  git checkout -B backup/data
  git add data-backups
  git commit -m "snapshot $(date -u +%FT%TZ)"
  git push -u origin backup/data
  ```

Rotation: keep the last 12 snapshots; delete older ones in PRs.

Pros: zero infra, free, restorable from history.
Cons: manual; relies on someone remembering.

## Path B: Cron-driven snapshots on Railway

If the Railway service has access to a cron tool, schedule:

```bash
0 5 * * * cd /app && node scripts/backup-data.js && git add data-backups && git commit -m "auto snapshot" && git push origin backup/data
```

Requires:

- Git credentials available to the container (GitHub deploy key or PAT).
- A separate Railway cron service (the bot itself should not push from main).

## Path C: S3 / object storage

When the data set grows beyond what is comfortable to track in git:

1. Provision an S3 bucket (or compatible: Cloudflare R2, Backblaze B2).
2. Add `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET` env vars.
3. Replace the file copy in `scripts/backup-data.js` with an `aws s3 sync` (or `@aws-sdk/client-s3` upload).
4. Configure bucket lifecycle to expire snapshots after N days.

This path is documented; not implemented in v1.0.0. Open a follow-up issue if you need it.

## Restore

To restore from a snapshot:

```bash
TARGET=data-backups/2026-05-10T17-30-00-000Z
cp $TARGET/*.json data/   # local
# or, on the Railway volume:
cp $TARGET/*.json $DATA_VOLUME_PATH/
```

Then redeploy. The bot's `seedDataFiles()` only seeds when target files are *missing*, so an explicit overwrite is safe.

## Verification

After any restore, run:

```bash
npm run audit:ai
```

Check that `knowledge: data/knowledge.json` reports the expected fact count.
