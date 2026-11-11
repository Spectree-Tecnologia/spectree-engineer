#!/usr/bin/env bash
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# change.diff ships with the fixture: it must show the field changing type, which a new-file diff cannot
exec bash "$here/../fixtures/scaffold.sh" caller-outside-diff
