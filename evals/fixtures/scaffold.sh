#!/usr/bin/env bash
# Builds a case's workspace: copies the fixture, docs/architecture.md (the plugin's ARCHITECTURE.md, so that it does not
# drift) and, for each file passed after the name, generates change.diff (the change under review, as a new-file
# diff — the eval's workspace has no git and no Bash for the agent).
# Usage (from a case's scaffold.sh): bash "$here/../fixtures/scaffold.sh" <fixture> [changed-file...]
set -euo pipefail
fixtures="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
name="$1"; shift
cp -R "$fixtures/$name/." .
mkdir -p docs && cp "$fixtures/../../ARCHITECTURE.md" docs/architecture.md
for f in "$@"; do git diff --no-index -- /dev/null "$f" >> change.diff || true; done
