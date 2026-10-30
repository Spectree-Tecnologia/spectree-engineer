#!/usr/bin/env bash
# Monta o workspace de um caso: copia o fixture, docs/architecture.md (o ARCHITECTURE.md do plugin, para não
# divergir) e, para cada arquivo passado depois do nome, gera change.diff (a mudança sob review, como diff de
# arquivo novo — o workspace do eval não tem git nem Bash para o agente).
# Uso (do scaffold.sh de um caso): bash "$here/../fixtures/scaffold.sh" <fixture> [arquivo-da-mudança...]
set -euo pipefail
fixtures="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
name="$1"; shift
cp -R "$fixtures/$name/." .
mkdir -p docs && cp "$fixtures/../../ARCHITECTURE.md" docs/architecture.md
for f in "$@"; do git diff --no-index -- /dev/null "$f" >> change.diff || true; done
