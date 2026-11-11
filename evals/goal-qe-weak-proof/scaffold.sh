#!/usr/bin/env bash
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# the contract and the owner's test first, so the shared scaffold can put the test in change.diff
cp -R "$here/../fixtures/goal-weak-proof/." .
bash "$here/../fixtures/scaffold.sh" update-account-bug modules/accounts/src/account/use-case/update-account.use-case.ts modules/accounts/test/account/update-account.test.ts
# goal mode has no ticket: the contract is the only statement of what was asked
rm -rf .scratch
