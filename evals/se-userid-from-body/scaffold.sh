#!/usr/bin/env bash
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$here/../fixtures/scaffold.sh" controller-userid-body apps/backend/src/modules/accounts/accounts.controller.ts
