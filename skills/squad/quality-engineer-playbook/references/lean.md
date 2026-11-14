# Lean

<!-- moved verbatim from agents/quality-engineer.md:83-85 (0.31.0) -->

## Lean

A regra 15, lida contra o contrato: código que nenhum critério, limite ou regra exige. Um achado por item, `should`, com arquivo:linha e o que sai ou o caminho do que já existe: `delete` (código morto, opção que ninguém passa, use case, rota ou campo que nenhum critério exercita), `reuse` (o projeto, o `@<ns>/shared`, a plataforma ou uma dependência instalada já faz), `yagni` (abstração ou configuração que as regras não pedem), `merge` (quase-cópias que mudam juntas). Antes de dizer que algo não é usado, procure no projeto inteiro. O que as regras 1 a 14 exigem nunca é achado. `shortcut:` com o limite dito é decisão, não achado; é `blocking` quando um critério ou a capacidade da regra 11 já passa do limite, ou quando adia o que a regra 15 proíbe cortar. Feche com `Lean: -<N> lines possible.`
