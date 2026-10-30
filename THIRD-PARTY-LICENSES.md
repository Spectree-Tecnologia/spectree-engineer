# Third-party licenses

## skills/engineering — Matt Pocock, https://github.com/mattpocock/skills (MIT)

Vendored at commit a496f55 (2026-10-29), adapted: `disable-model-invocation` removed where the orchestrator must call the skill.

MIT License

Copyright (c) 2026 Matt Pocock

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## skills/monolith — skills do curso Spec-Driven Development para Monólitos Modulares (Módulos 7/8)

Copiadas de `sources/skills-modulo-7/skills`. Alterações: correções para Windows em `utils/skill-run-ops.mjs` (spawn com shell); `config-project/scripts/project-init.mjs` (`packageManager` pinado, `--disable-git` no create-next-app, `@nestjs/cli@11` e `create-next-app@15` pinados, escreve `skills.config.json` e `.gitattributes`, alinha o TypeScript da raiz ao backend); `config-new-module` resolve a raiz por `cwd` (roda do cache do plugin); `config-prisma` nomeia o container pelo projeto e prova a conexão com `SELECT 1`; `utils/resolve-skill-config.mjs` procura o config na raiz e assume `apps/frontend`; templates de `module-aggregate` (`tryCreate`, caminho do mock); caminhos `.claude/skills/…` reescritos para `${CLAUDE_PLUGIN_ROOT}/skills/monolith/…` e referências a `skills-standards.md` (inexistente) removidas; scaffold morto removido de `config-project`. Material do curso; uso interno Spectree.

## templates/shared — o pacote `shared` feito à mão no curso (Módulo 8)

Copiado de `sources/shared-modulo-8/shared` sem `node_modules`/`dist`. O `name` é trocado para `@<namespace>/shared` no bootstrap.
