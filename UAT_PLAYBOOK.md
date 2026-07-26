# UAT Playbook — headlamp-polaris-plugin

This playbook documents the steps to validate a headlamp-polaris-plugin release
candidate before merging `uat → main`.

## Pre-flight

1. Confirm the GitHub Release for the target version exists:
   ```
   gh release view <version> --repo privilegedescalation/headlamp-polaris-plugin
   ```
2. Note the expected `sha256` from `artifacthub-pkg.yml` under
   `headlamp/plugin/archive-checksum`.

## Step 1 — Verify archive-url resolves

```bash
VERSION=v1.0.1
ASSET="headlamp-polaris-1.0.1.tar.gz"
ARCHIVE_URL="https://github.com/privilegedescalation/headlamp-polaris-plugin/releases/download/${VERSION}/${ASSET}"

# Must return HTTP 302 → redirects to release-assets.githubusercontent.com
curl -sI "${ARCHIVE_URL}" | head -5
```

Expected: `HTTP/2 302` with `location:` pointing to
`release-assets.githubusercontent.com`.

## Step 2 — Verify sha256 checksum

```bash
curl -sL "${ARCHIVE_URL}" | sha256sum
```

Expected output must match the `headlamp/plugin/archive-checksum` value in
`artifacthub-pkg.yml` (strip the `sha256:` prefix before comparing).

For v1.0.1 the expected sha256 is:
`1e05d079c7032cf55ebde85e116cb65b686d207f4b6a3b0f716f0af93f933e7e`

## Step 3 — Confirm no dead links remain

```bash
# No farh.net / git.farh.net references should appear in these files
grep -rn "farh.net\|git\.farh" README.md artifacthub-pkg.yml
```

Expected: zero matches.

## Step 4 — ArtifactHub metadata correctness

Open `artifacthub-pkg.yml` and verify:
- `version:` matches the release tag
- `headlamp/plugin/archive-url` uses `github.com` (not `git.farh.net`)
- `headlamp/plugin/archive-checksum` matches the sha256 from Step 2
- No other `farh.net` references

## Step 5 — README version pin

Confirm `README.md` line 67 references the current release version and
archive filename (not an older release):

```bash
grep "releases/download" README.md
```

## Pass criteria

- [ ] Archive URL resolves (302 → `release-assets.githubusercontent.com`)
- [ ] Downloaded asset sha256 matches `artifacthub-pkg.yml` checksum
- [ ] Zero `farh.net` references in `README.md` and `artifacthub-pkg.yml`
- [ ] `artifacthub-pkg.yml` version and checksum match the release
- [ ] `README.md` version pin matches the release

All five checks must pass before approving `uat → main`.
