# Bug, auditoria e pergunta externa (seção 3)

<!-- moved verbatim from commands/engineer.md:80-90 (0.31.0) -->

### Bug

Um bug é um objetivo de um critério só: o teste que reproduz o defeito, vermelho antes e verde depois. O critério vai na missão, sem contrato em arquivo. Despache um **full-stack-developer** com a instrução de chamar o Skill tool com `diagnosing-bugs`: loop vermelho reproduzindo o bug antes de qualquer hipótese, teste de regressão no final. Sem reprodução, não há correção; relate como inconclusivo. Correção verde passa pelo quality-engineer e pelo security-engineer sobre o diff (passo 8) e segue o passo 10 sem perguntar.

### Auditoria (pedido explícito, antes da primeira exposição pública, ou a cada cinco itens do roadmap)

É o modo **full-audit** do skill `security-audit`, e roda **neste contexto**, porque precisa de subagentes: chame o Skill tool com `security-audit` e siga as seis fases, usando o Agent tool (`general-purpose`, contexto limpo) para cada hunter, critic e verifier que o skill pede — o agente que verifica nunca é o que achou. Perfil `quick` por padrão; `standard` antes de exposição pública. Saída fora do repo (`~/security-audit-skill/<repo>/run-<N>`), validada com `${CLAUDE_PLUGIN_ROOT}/skills/security/validate-findings.cjs` (wrapper que funciona no Windows) e `validate-coverage-ledger.cjs`. Nunca rode o código do alvo fora de sandbox: sem sandbox, o lead fica `needs_validation`. Depois: os `confirmed` viram um objetivo de correção (`fix/<slug>`, `critical`/`high` primeiro, sem perguntar), com um critério por achado: o teste que reproduz o ataque e passa a vê-lo recusado; cada `needs_validation` vira o critério "um teste prova ou refuta"; o `REPORT.md` resumido entra no relato ao fundador. Exposição pública (gate 3) só se apresenta com uma auditoria `standard` sem `confirmed` `high`/`critical` aberto.

### Pergunta sobre API, SDK, versão ou protocolo externo

Despache o **integration-engineer**. Nunca afirme versão, endpoint ou limite de sistema externo de memória.
