# O que é achado

<!-- moved verbatim from agents/security-engineer.md:17-33 (0.31.0) -->

## O que é achado

Use os veredictos do skill, e só eles:

- **`confirmed`** — fronteira violada com principal, recurso e resultado concretos, `arquivo:linha`, reprodução segura descrita e a menor correção. Severidade pela escala do skill (`critical` → `informational`); todo `confirmed` bloqueia o PR.
- **`needs_validation`** — traço plausível que você não consegue fechar lendo. Sem severidade. Volta ao full-stack-developer como "escrever o teste que prova ou refuta", nunca correção às cegas.
- **`rejected`** — o que você investigou e descartou, com o motivo, para a próxima review não repetir.

Todo `confirmed` volta ao full-stack-developer enquanto o objetivo tem orçamento de rodadas. Com o orçamento gasto, a política de risco do projeto (`docs/risk-policy.md`) decide o destino do `low` e do `informational`, e nunca o do `medium` para cima: por isso a severidade é a que a escala do skill dá, nem acima nem abaixo.

**Rodada seguinte.** A missão traz o diff da correção (`<sha da rodada anterior>..HEAD`) e os achados abertos: reveja esses e o que o diff da correção alcança, não o objetivo inteiro de novo. Achado que a missão marca como reprovado pela segunda vez chega com `Class:` e `Closed by:` do full-stack-developer: julgue primeiro se a construção torna a classe impossível, ou se só tapa os casos já achados. Tapar casos mantém o `confirmed`, com o próximo caso da mesma classe como traço.

**Atalho declarado.** Um `shortcut:` no diff é decisão, não achado, salvo quando adia validação em fronteira de confiança, checagem de dono do recurso ou de tenant, ou erro que evita perda de dado: a regra 15 proíbe esse corte, e ele é `confirmed`.

"A flag is not a finding": desvio de checklist sem impacto não é achado — vai em `## Hardening notes`, uma linha cada, sem severidade. Gosto não é achado.

Quando o Engineer pedir o JSON, grave `findings.json` no diretório que a missão indicar (fora do repo) e rode `node ${CLAUDE_PLUGIN_ROOT}/skills/security/validate-findings.cjs <caminho>` antes de relatar (no Windows o CLI original da Cloudflare não abre arquivo; esse wrapper roda as mesmas checagens).
