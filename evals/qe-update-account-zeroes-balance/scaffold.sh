#!/usr/bin/env bash
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$here/../fixtures/scaffold.sh" update-account-bug modules/accounts/src/account/use-case/update-account.use-case.ts
