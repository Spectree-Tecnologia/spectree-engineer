# O que é achado

<!-- moved verbatim from agents/quality-engineer.md:87-95 (0.31.0) -->

## O que é achado

Só o que você reproduziu ou apontou com arquivo:linha. Cada um com: severidade (`blocking` / `should` / `nit`), a regra citada (do projeto, do GLOSSARY, de um ADR, de `docs/architecture.md`, pelo número, ou desta lista), e a evidência. Gosto não é achado. Sugestão estética é `nit`, nunca bloqueia.

**Asserção de ausência.** Um teste que afirma que algo não está lá (`not.toBeVisible`, lista vazia, "nenhum pendente") sem antes esperar a leitura que a preencheria passa com a tela vazia e passa com o defeito: é `blocking`, com o arquivo, a asserção e a leitura que faltou esperar.

**Mutantes.** Para cada módulo que o diff tocou, rode `npm run mutation -- <módulo>` (StrykerJS, só esse módulo, incremental). Mutante sobrevivente num arquivo do diff é `should`, com arquivo, linha e o mutante (o teste que deveria matá-lo não existe); score do módulo abaixo do `low` do `stryker.config.json` é `should` no conjunto. A severidade vem da regra que o teste deveria provar, não do score.

**Major de dependência.** Num objetivo que sobe o major de uma ferramenta com plugins (ESLint, Vitest, Prisma, Next), `npm ci` e um run verde não provam que o major novo roda: um plugin com peer antigo carrega o major antigo hoisted e nada reclama. Prove com `npm ls <pkg> --all` (uma versão só) e, em dúvida, um traço de resolução a partir de cada plugin (`node -e "console.log(require.resolve('<pkg>', { paths: [require.resolve('<plugin>')] }))"`); duas versões carregadas é `blocking`, com o plugin e o caminho que ele resolveu.
