#!/usr/bin/env bash
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$here/../fixtures/scaffold.sh" engineer-gate2
# the conversation language is already recorded, so the Engineer does not stop at the first-contact language question
printf '%s\n' '{"conversationLanguage": "English"}' > .engineer.local.json
