#!/usr/bin/env bash
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$here/../fixtures/scaffold.sh" core-imports-nest modules/accounts/src/account/use-case/create-account.use-case.ts
